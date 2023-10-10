defmodule ColoringBookWeb.CanvasIndexLive do
  use ColoringBookWeb, :live_view
  require Ash.Query

  alias ColoringBook.Artwork

  def mount(params, _session, socket) do
    current_user = socket.assigns[:current_user]

    case Artwork.Canvas.get_by_user_id(current_user.id) do
      {:ok, canvas} ->
        {:ok, socket |> Phoenix.LiveView.redirect(to: ~p"/canvas/#{canvas.id}")}
      _ ->
        canvas = Artwork.Canvas.create!(%{user_id: current_user.id})
        {:ok, socket |> Phoenix.LiveView.redirect(to: ~p"/canvas/#{canvas.id}")}
    end
  end
end
