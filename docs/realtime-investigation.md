# Realtime investigation

The server creates an ephemeral channel and immediately calls `channel.send(...)` without subscribing it. Supabase documents that this path uses HTTP/REST rather than an established WebSocket. The browser-side room hook is separately subscribed to the same room topic and receives Broadcast events over its client Realtime connection.

The warning therefore does **not** mean audience browsers are failing to use WebSockets. It means the server-originated event is being implicitly delivered through the REST fallback. The supported fix is to use the explicit `channel.httpSend(event, payload)` API when emitting from a route/service without first maintaining a server WebSocket subscription. This preserves the desired architecture: server HTTP-to-Realtime delivery, then Realtime WebSocket fan-out to connected browsers.

The layout issue is independent: the current vote rail becomes visible only after the audience header and large spotlight. The correction will condense the room header, place the vote action in the initial viewport, and make the transcript a contained scroll region below it rather than extending the page.

## MindArena comparison

MindArena keeps long-lived client room channels, subscribes before emitting, and uses `channel.send(...)` only from that subscribed browser-side channel. That is an appropriate WebSocket pattern for client-originated invalidation events. Persona Room’s server route has a different origin: it creates a short-lived server channel only to fan out an event after a database write. For that short-lived server path, `httpSend(...)` is the direct, documented equivalent and removes the implicit-fallback warning. Persona Room continues to use browser-side `.subscribe()` channels for actual WebSocket reception, matching MindArena’s subscription lifecycle.
