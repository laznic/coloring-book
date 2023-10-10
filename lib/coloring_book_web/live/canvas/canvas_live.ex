defmodule ColoringBookWeb.CanvasLive do
  use ColoringBookWeb, :live_view
  require Ash.Query

  alias ColoringBook.Artwork

  @img2prompt_model "pharmapsychotic/clip-interrogator:8151e1c9f47e696fa316146a2e35812ccf79cfc9eba05b11c7f450155102af70"
  @sd_model "stability-ai/sdxl:1bfb924045802467cf8869d96b231a12e6aa994abfe37e337c63a4e49a8c6c41"
  @sd_api_url "https://api.stability.ai/v1"

  def mount(params, _session, socket) do
    {:ok,
      socket
      |> assign(color: "#000")
      |> assign(background: "#fff")
      |> assign(no_drawings: true)
      |> assign(theme: "dark")
      |> push_event("selected_color_#{params["id"]}", %{ color: "#000" })
      |> push_event("selected_background_color_#{params["id"]}", %{ color: "#fff" })
    }
  end

  @impl true
  def handle_params(%{"id" => id}, _, socket) do
    canvas = Artwork.Canvas.get_by_id!(id, load: [:generations])
    generations = canvas.generations |> Enum.map(&%{ prompt: &1.prompt, image_url: &1.image_url, top: &1.top, left: &1.left })

    {:noreply,
     socket
     |> assign(:canvas_id, canvas.id)
     |> assign(:show_info_modal, Enum.empty?(generations))
     |> push_event("render_initial_generations_#{canvas.id}", %{ generations: generations })
    }
  end

  @impl true
  def handle_event("send_drawing", %{"drawing" => drawing, "coords" => coords}, socket) do
    Task.async(fn ->
      gen_image_prompt(drawing, coords, socket.assigns.canvas_id)
    end)

    {:noreply, socket |> clear_flash() |> put_flash(:generating, "Generating image prompt, this can take up to 5 minutes.")}
  end

  @impl true
  def handle_event("start_initial_image_generation", _params, socket) do
    Task.async(fn ->
      gen_image(socket.assigns.generation_id)
    end)

    {:noreply, socket |> put_flash(:generating, "Generating image...")}
  end

  @impl true
  def handle_event("start_inpainting", %{"image" => image, "mask" => mask}, socket) do
    Task.async(fn ->
      gen_image(socket.assigns.generation_id, image, mask)
    end)

    {:noreply, socket |> put_flash(:generating, "Generating image...")}
  end

  @impl true
  def handle_event("select_color", %{"color" => color}, socket) do
    {:noreply, socket |> assign(color: color) |> push_event("selected_color_#{socket.assigns.canvas_id}", %{ color: color })}
  end

  @impl true
  def handle_event("select_background_color", %{"background" => background}, socket) do
    {:noreply, socket |> assign(background: background) |> push_event("selected_background_color_#{socket.assigns.canvas_id}", %{ color: background })}
  end

  @impl true
  def handle_event("can_accept_drawing", _params, socket) do
    {:noreply, socket |> assign(no_drawings: false)}
  end

  @impl true
  def handle_event("accept_drawing", _params, socket) do
    {:noreply, socket |> assign(no_drawings: true) |> push_event("accepted_drawing_#{socket.assigns.canvas_id}", %{})}
  end

  @impl true
  def handle_event("change_theme", _params, socket) do
    theme = if socket.assigns.theme == "dark" do
      "light"
    else
      "dark"
    end

    {:noreply, socket |> assign(theme: theme) |> push_event("theme_changed_#{socket.assigns.canvas_id}", %{ theme: theme })}
  end

  @impl true
  def handle_event("toggle_info_modal", _params, socket) do
    {:noreply, assign(socket, show_info_modal: !socket.assigns.show_info_modal)}
  end

  @impl true
  def handle_info({ref, %{prompt: prompt, coords: coords, generation_id: generation_id}}, socket) do
    Process.demonitor(ref, [:flush])

    {:noreply,
      socket
      |> assign(generation_id: generation_id)
      |> clear_flash()
      |> push_event("generated_image_prompt_#{socket.assigns.canvas_id}", %{ prompt: prompt, coords: coords })
    }
  end

  @impl true
  def handle_info({ref, %{image: image, coords: coords}}, socket) do
    Process.demonitor(ref, [:flush])

    case image do
      nil ->
        Artwork.Generation.get_by_id!(socket.assigns.generation_id) |> Artwork.Generation.delete!()
        {:noreply, socket |> clear_flash() |> put_flash(:error, "Couldn't generate an image, please try again!") |> push_event("error_in_generation_#{socket.assigns.canvas_id}", %{})}
      _ ->
        {:noreply, socket |> clear_flash() |> put_flash(:info, "Image generated") |> push_event("generated_image_#{socket.assigns.canvas_id}", %{ image: image, coords: coords })}
    end
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
    generation = Artwork.Generation.get_by_id!(generation_id, load: [:canvas])

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

    case Req.post(req, url: "/generation/stable-inpainting-512-v2-0/image-to-image/masking", body: body_stream) do
      {:ok, res} -> handle_inpainting_response(res, generation)
      {:error, _reason} -> %{image: nil, coords: %{ top: generation.top, left: generation.left }}
    end
  end

  @impl true
  defp handle_inpainting_response(res, generation) do
    case res.body["artifacts"] do
      nil -> %{image: nil, coords: %{ top: generation.top, left: generation.left }}
      [] -> %{image: nil, coords: %{ top: generation.top, left: generation.left }}
      artifacts ->
        image_base64 = artifacts |> Enum.at(0) |> Map.get("base64")

        multipart = Multipart.new()
          |> Multipart.add_part(Multipart.Part.file_content_field("#{generation.id}.jpeg", Base.decode64!(image_base64), :generated_image))

        body_stream = Multipart.body_stream(multipart)
        content_type = Multipart.content_type(multipart, "multipart/form-data")

        req = Req.new(base_url: System.get_env("SUPABASE_URL"))
          |> Req.Request.put_header("accept", "application/json")
          |> Req.Request.put_header("authorization", "Bearer #{System.get_env("SUPABASE_SERVICE_KEY")}")
          |> Req.Request.put_header("content-type", content_type)

        upload_res = Req.post!(req, url: "/storage/v1/object/canvas-images/#{generation.canvas.id}/#{generation.id}.jpeg", body: body_stream)
        generated_image_url = "#{System.get_env("SUPABASE_URL")}/storage/v1/object/public/#{upload_res.body["Key"]}"

        Artwork.Generation.update!(generation, %{
          image_url: generated_image_url
        })

        %{image: generated_image_url, coords: %{ top: generation.top, left: generation.left }}
    end
  end
end
