defmodule ColoringBookWeb.CanvasLive do
  use ColoringBookWeb, :live_view

  @img2prompt_model "methexis-inc/img2prompt:50adaf2d3ad20a6f911a8a9e3ccf777b263b8596fbd2c8fc26e8888f8a0edbb5"

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
    prompt = Replicate.run(@img2prompt_model, %{ image: drawing })
    %{prompt: prompt |> String.replace("\n", "") |> String.trim()}
  end
end
