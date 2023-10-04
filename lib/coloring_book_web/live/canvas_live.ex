defmodule ColoringBookWeb.CanvasLive do
  use ColoringBookWeb, :live_view

  def mount(params, _session, socket) do
    {:ok, assign(socket, canvas: %{})}
  end
end
