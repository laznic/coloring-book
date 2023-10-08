defmodule ColoringBook.Artwork.Registry do
  use Ash.Registry

  entries do
    entry ColoringBook.Artwork.Canvas
    entry ColoringBook.Artwork.Generation
  end
end
