export function handleRequest(headers, bodyData, socket) {
  const responseBody = "Presistent connection processed.\n";
  const response =
    "HTTP/1.1 200 OK\r\n" +
    "Content-Type: text/plain\r\n" +
    `Content-Length: ${Buffer.byteLength(responseBody)}\r\n` +
    "\r\n" +
    responseBody;

  socket.write(response);
}
