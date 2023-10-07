defmodule ColoringBookWeb.CanvasLive do
  use ColoringBookWeb, :live_view

  @img2prompt_model "pharmapsychotic/clip-interrogator:8151e1c9f47e696fa316146a2e35812ccf79cfc9eba05b11c7f450155102af70"
  @sd_model "stability-ai/sdxl:1bfb924045802467cf8869d96b231a12e6aa994abfe37e337c63a4e49a8c6c41"
  @sd_api_url "https://api.stability.ai/v1"

  def mount(params, _session, socket) do
    {:ok, socket}
  end

  @impl true
  def handle_event("send_drawing", %{"drawing" => drawing, "coords" => coords}, socket) do
    Task.async(fn ->
      gen_image_prompt(drawing, coords)
    end)

    {:noreply, socket}
  end

  @impl true
  def handle_event("start_initial_image_generation", %{"prompt" => prompt, "coords" => coords}, socket) do
    Task.async(fn ->
      gen_image(prompt, coords)
    end)

    {:noreply, socket}
  end

  @impl true
  def handle_event("start_inpainting", %{"prompt" => prompt, "coords" => coords, "image" => image, "mask" => mask}, socket) do
    Task.async(fn ->
      gen_image(prompt, coords, image, mask)
    end)

    {:noreply, socket}
  end

  @impl true
  def handle_info({ref, %{prompt: prompt, coords: coords}}, socket) do
    Process.demonitor(ref, [:flush])

    {:noreply, push_event(socket, "generated_image_prompt", %{ prompt: prompt, coords: coords })}
  end

  @impl true
  def handle_info({ref, %{image: image, coords: coords}}, socket) do
    Process.demonitor(ref, [:flush])

    {:noreply, push_event(socket, "generated_image", %{ image: image, coords: coords })}
  end

  @impl true
  def handle_info({ref, %{image: nil}}, socket) do
    Process.demonitor(ref, [:flush])
  end

  defp gen_image_prompt(drawing, coords) do
    prompt = Replicate.run(@img2prompt_model, %{ image: drawing, mode: "classic", clip_model_name: "ViT-H-14/laion2b_s32b_b79k" })
    %{prompt: prompt, coords: coords}
  end

  defp gen_image(%{ prompt: nil }) do
    %{image: nil}
  end

  defp gen_image(prompt, coords) do
    [image] = Replicate.run(@sd_model, %{ prompt: prompt, width: 1024, height: 1024, negative_prompt: "nsfw, ugly, blurry" })
    %{image: image, coords: coords}
  end

  defp gen_image(prompt, coords, base_image, mask) do
    File.write!("./init_image.png", Base.decode64!(base_image))
    File.write!("./mask.png", Base.decode64!(mask))

    multipart = Multipart.new()
      |> Multipart.add_part(Multipart.Part.text_field(prompt, "text_prompts[0][text]"))
      |> Multipart.add_part(Multipart.Part.text_field("0.5", "text_prompts[0][weight]"))
      |> Multipart.add_part(Multipart.Part.text_field("nsfw, ugly, blurry", "text_prompts[1][text]"))
      |> Multipart.add_part(Multipart.Part.text_field("-1.0", "text_prompts[1][weight]"))
      |> Multipart.add_part(Multipart.Part.file_field("./init_image.png", :init_image))
      |> Multipart.add_part(Multipart.Part.file_field("./mask.png", :mask_image))
      |> Multipart.add_part(Multipart.Part.text_field("MASK_IMAGE_WHITE", :mask_source))

    body_stream = Multipart.body_stream(multipart)
    content_length = Multipart.content_length(multipart)
    content_type = Multipart.content_type(multipart, "multipart/form-data")

    req = Req.new(base_url: @sd_api_url)
      |> Req.Request.put_header("accept", "application/json")
      |> Req.Request.put_header("authorization", "Bearer #{System.get_env("STABILITY_AI_TOKEN")}")
      |> Req.Request.put_header("content-type", content_type)

    res = Req.post!(req, url: "/generation/stable-inpainting-512-v2-0/image-to-image/masking", body: body_stream)

    %{image: "data:image/png;base64,#{res.body["artifacts"] |> Enum.at(0) |> Map.get("base64")}", coords: coords}
  end
end
