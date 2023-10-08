defmodule ColoringBookWeb.CanvasLive do
  use ColoringBookWeb, :live_view
  require Ash.Query

  alias ColoringBook.Artwork

  @img2prompt_model "pharmapsychotic/clip-interrogator:8151e1c9f47e696fa316146a2e35812ccf79cfc9eba05b11c7f450155102af70"
  @sd_model "stability-ai/sdxl:1bfb924045802467cf8869d96b231a12e6aa994abfe37e337c63a4e49a8c6c41"
  @sd_api_url "https://api.stability.ai/v1"

  def mount(params, _session, socket) do
    new_canvas = Artwork.Canvas.create!()

    {:ok, assign(socket, canvas_id: new_canvas.id)}
  end

  @impl true
  def handle_event("send_drawing", %{"drawing" => drawing, "coords" => coords}, socket) do
    Task.async(fn ->
      gen_image_prompt(drawing, coords, socket.assigns.canvas_id)
    end)

    {:noreply, socket}
  end

  @impl true
  def handle_event("start_initial_image_generation", _params, socket) do
    Task.async(fn ->
      gen_image(socket.assigns.generation_id)
    end)

    {:noreply, socket}
  end

  @impl true
  def handle_event("start_inpainting", %{"prompt" => prompt, "coords" => coords, "image" => image, "mask" => mask}, socket) do
    Task.async(fn ->
      gen_image(socket.assigns.generation_id, image, mask)
    end)

    {:noreply, socket}
  end

  @impl true
  def handle_info({ref, %{prompt: prompt, coords: coords, generation_id: generation_id}}, socket) do
    Process.demonitor(ref, [:flush])

    {:noreply, assign(socket, generation_id: generation_id) |> push_event("generated_image_prompt", %{ prompt: prompt, coords: coords })}
  end

  @impl true
  def handle_info({ref, %{image: image, coords: coords}}, socket) do
    Process.demonitor(ref, [:flush])

    {:noreply, push_event(socket, "generated_image", %{ image: image, coords: coords })}
  end

  @impl true
  def handle_info({ref, %{image: image}}, socket) do
    Process.demonitor(ref, [:flush])

    {:noreply, push_event(socket, "generated_image", %{ image: image })}
  end

  @impl true
  def handle_info({ref, %{image: nil}}, socket) do
    Process.demonitor(ref, [:flush])
  end

  defp gen_image_prompt(drawing, coords, canvas_id) do
    prompt = Replicate.run(@img2prompt_model, %{ image: drawing, mode: "classic", clip_model_name: "ViT-H-14/laion2b_s32b_b79k" })
    generation = Artwork.Generation.create!(%{ prompt: prompt, top: coords["top"], left: coords["left"], canvas_id: canvas_id })

    %{prompt: prompt, coords: coords, generation_id: generation.id}
  end

  defp gen_image(%{ prompt: nil }) do
    %{image: nil}
  end

  defp gen_image(generation_id) do
    generation = Artwork.Generation.get_by_id!(generation_id)
    [image] = Replicate.run(@sd_model, %{ prompt: generation.prompt, width: 1024, height: 1024, negative_prompt: "nsfw, ugly, blurry" })
    Artwork.Generation.update!(generation, %{ image_url: image })

    %{image: image, coords: %{ top: generation.top, left: generation.left }}
  end

  defp gen_image(generation_id, base_image, mask) do
    generation = Artwork.Generation.get_by_id!(generation_id)

    multipart = Multipart.new()
      |> Multipart.add_part(Multipart.Part.text_field(generation.prompt, "text_prompts[0][text]"))
      |> Multipart.add_part(Multipart.Part.text_field("0.5", "text_prompts[0][weight]"))
      |> Multipart.add_part(Multipart.Part.text_field("nsfw, ugly, blurry", "text_prompts[1][text]"))
      |> Multipart.add_part(Multipart.Part.text_field("-1.0", "text_prompts[1][weight]"))
      |> Multipart.add_part(Multipart.Part.file_content_field("init_image.png", String.replace(base_image, "data:image/png;base64,", "") |> Base.decode64!(), :init_image))
      |> Multipart.add_part(Multipart.Part.file_content_field("mask.png", String.replace(mask, "data:image/png;base64,", "") |> Base.decode64!(), :mask_image))
      |> Multipart.add_part(Multipart.Part.text_field("MASK_IMAGE_WHITE", :mask_source))

    body_stream = Multipart.body_stream(multipart)
    content_length = Multipart.content_length(multipart)
    content_type = Multipart.content_type(multipart, "multipart/form-data")

    req = Req.new(base_url: @sd_api_url)
      |> Req.Request.put_header("accept", "application/json")
      |> Req.Request.put_header("authorization", "Bearer #{System.get_env("STABILITY_AI_TOKEN")}")
      |> Req.Request.put_header("content-type", content_type)

    res = Req.post!(req, url: "/generation/stable-inpainting-512-v2-0/image-to-image/masking", body: body_stream)
    image_base64 = res.body["artifacts"] |> Enum.at(0) |> Map.get("base64")

    multipart = Multipart.new()
      |> Multipart.add_part(Multipart.Part.file_content_field("generated_image.png", Base.decode64!(image_base64), :generated_image))

    body_stream = Multipart.body_stream(multipart)
    content_type = Multipart.content_type(multipart, "multipart/form-data")

    req = Req.new(base_url: System.get_env("SUPABASE_URL"))
      |> Req.Request.put_header("accept", "application/json")
      |> Req.Request.put_header("authorization", "Bearer #{System.get_env("SUPABASE_SERVICE_KEY")}}")
      |> Req.Request.put_header("content-type", content_type)

    upload_res = Req.post!(req, url: "/storage/v1/object/canvas-images/#{generation_id}/generated_image.png", body: body_stream)
    generated_image_url = "#{System.get_env("SUPABASE_URL")}/storage/v1/object/public/#{upload_res.body["Key"]}"

    Artwork.Generation.update!(generation, %{
      image_url: generated_image_url
    })

    %{image: generated_image_url, coords: %{ top: generation.top, left: generation.left }}
  end
end
