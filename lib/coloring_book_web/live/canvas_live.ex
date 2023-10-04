defmodule ColoringBookWeb.CanvasLive do
  use ColoringBookWeb, :live_view

  @img2prompt_model "pharmapsychotic/clip-interrogator:8151e1c9f47e696fa316146a2e35812ccf79cfc9eba05b11c7f450155102af70"

  def mount(params, _session, socket) do
    {:ok, assign(socket, canvas: %{})}
  end

  @impl true
  def handle_info({ref, %{prompt: prompt}}, socket) do
    Process.demonitor(ref, [:flush])
    {:noreply, push_event(socket, "generated_image_prompt", %{ prompt: prompt })}
  end

  @impl true
  def handle_event("send_drawing", %{"drawing" => drawing}, socket) do
    Task.async(fn ->
      gen_image_prompt(drawing)
    end)

    {:noreply, assign(socket, canvas: drawing)}
  end

  defp gen_image_prompt(drawing) do
    prompt = Replicate.run(@img2prompt_model, %{ image: drawing, clip_model_name: "ViT-bigG-14/laion2b_s39b_b160k" })
    %{prompt: prompt |> String.replace("\n", "") |> String.trim()}
  end
end
