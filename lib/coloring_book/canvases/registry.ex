defmodule ColoringBook.Canvases.Registry do
  use Ash.Registry

  entries do
    entry ColoringBook.Canvases.Canvas
    entry ColoringBook.Canvases.Generation
  end
end
