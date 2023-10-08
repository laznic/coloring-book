defmodule ColoringBook.Canvases do
  use Ash.Api

  resources do
    registry ColoringBook.Canvases.Registry
  end
end
