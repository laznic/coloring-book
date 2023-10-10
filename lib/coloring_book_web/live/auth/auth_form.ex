defmodule ColoringBookWeb.AuthLive.AuthForm do
  use ColoringBookWeb, :live_component
  use Phoenix.HTML
  alias AshPhoenix.Form

  @impl true
  def update(assigns, socket) do
    socket =
      socket
      |> assign(assigns)
      |> assign(trigger_action: false)

    {:ok, socket}
  end

  @impl true
  def handle_event("validate", %{"user" => params}, socket) do
    form = socket.assigns.form |> Form.validate(params, errors: false)

    {:noreply, assign(socket, form: form)}
  end

  @impl true
  def handle_event("submit", %{"user" => params}, socket) do
    form = socket.assigns.form |> Form.validate(params)

    socket =
      socket
      |> assign(:form, form)
      |> assign(:errors, Form.errors(form))
      |> assign(:trigger_action, form.valid?)

    {:noreply, socket}
  end

  @impl true
  def render(assigns) do
    ~H"""
    <div>
      <ul class="text-red-500">
        <%= if @form.errors do %>
          <%= for {k, v} <- @errors do %>
            <li>
              <%= humanize("#{k} #{v}") %>
            </li>
          <% end %>
        <% end %>
      </ul>
      <.form
        :let={f}
        for={@form}
        phx-change="validate"
        phx-submit="submit"
        phx-trigger-action={@trigger_action}
        phx-target={@myself}
        action={@action}
        method="POST"
      >
        <fieldset class="form-group">
          <%= text_input(f, :username,
            class: "form-control rounded-md",
            placeholder: "Username"
          ) %>
        </fieldset>
        <fieldset class="form-group">
          <%= password_input(f, :password,
            class: "form-control rounded-md",
            placeholder: "Password"
          ) %>
        </fieldset>
        <%= submit(@cta, class: "mt-4 bg-yellow-500 text-yellow-950 font-bold px-4 py-2 rounded border border-amber-200 shadow-lg text-center transition-all focus:-translate-y-[2px] focus:bg-yellow-400 focus:border-amber-100 focus:shadow-xl hover:-translate-y-[2px] hover:bg-yellow-400 hover:border-amber-100 hover:shadow-xl") %>
      </.form>
    </div>
    """
  end
end
