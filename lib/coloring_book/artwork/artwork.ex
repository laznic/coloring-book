defmodule ColoringBook.Artwork do
  use Ash.Api

  resources do
    registry ColoringBook.Artwork.Registry
  end
end
