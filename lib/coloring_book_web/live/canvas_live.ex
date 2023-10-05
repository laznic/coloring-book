defmodule ColoringBookWeb.CanvasLive do
  use ColoringBookWeb, :live_view

  @img2prompt_model "pharmapsychotic/clip-interrogator:8151e1c9f47e696fa316146a2e35812ccf79cfc9eba05b11c7f450155102af70"
  @sd_model "stability-ai/sdxl:1bfb924045802467cf8869d96b231a12e6aa994abfe37e337c63a4e49a8c6c41"

  def mount(params, _session, socket) do
    {:ok, assign(socket, canvas: %{})}
  end

  @impl true
  def handle_event("send_drawing", %{drawing: drawing}, socket) do
    Task.async(fn ->
      gen_image_prompt(drawing)
    end)

    {:noreply, assign(socket, canvas: drawing)}
  end

  @impl true
  def handle_info({ref, %{prompt: prompt}}, socket) do
    Process.demonitor(ref, [:flush])

    Task.async(fn ->
      gen_image(%{prompt: prompt})
    end)

    {:noreply, push_event(socket, "generated_image_prompt", %{ prompt: prompt })}
  end

  defp gen_image_prompt(drawing) do
    prompt = Replicate.run(@img2prompt_model, %{ image: drawing, mode: "classic", clip_model_name: "ViT-H-14/laion2b_s32b_b79k" })
    %{prompt: prompt}
  end

  defp gen_image(%{ prompt: prompt }) do
    image = Replicate.run(@sd_model, %{ prompt: prompt, width: 512, height: 512 })
    %{image: image}
  end

  defp gen_image(%{ prompt: prompt, base_image: base_image, mask: mask }) do
    image = Replicate.run(@sd_model, %{ prompt: prompt, image: base_image, mask: mask, width: 512, height: 512 })
    %{image: image}
  end
end
