defmodule ColoringBook.Artwork do
  use Ash.Api

  resources do
    resource ColoringBook.Artwork.Canvas
    resource ColoringBook.Artwork.Generation
  end
end
