defmodule ColoringBook.Application do
  # See https://hexdocs.pm/elixir/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    children = [
      # Start the Telemetry supervisor
      ColoringBookWeb.Telemetry,
      # Start the Ecto repository
      ColoringBook.Repo,
      # Start the PubSub system
      {Phoenix.PubSub, name: ColoringBook.PubSub},
      # Start Finch
      {Finch, name: ColoringBook.Finch},
      # Start the Endpoint (http/https)
      ColoringBookWeb.Endpoint,
      # Start a worker by calling: ColoringBook.Worker.start_link(arg)
      # {ColoringBook.Worker, arg}
      {AshAuthentication.Supervisor, otp_app: :coloring_book}
    ]

    # See https://hexdocs.pm/elixir/Supervisor.html
    # for other strategies and supported options
    opts = [strategy: :one_for_one, name: ColoringBook.Supervisor]
    Supervisor.start_link(children, opts)
  end

  # Tell Phoenix to update the endpoint configuration
  # whenever the application is updated.
  @impl true
  def config_change(changed, _new, removed) do
    ColoringBookWeb.Endpoint.config_change(changed, removed)
    :ok
  end
end
