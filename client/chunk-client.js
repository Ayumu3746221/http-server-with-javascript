import net from "node:net";

const client = net.createConnection({ port: 8080 }, () => {
  console.log("[Client] Connected to server. Sending headers...");

  // 1. ヘッダーの送信（Transfer-Encoding: chunked を明示）
  client.write("POST / HTTP/1.1\r\n");
  client.write("Host: localhost:8080\r\n");
  client.write("Transfer-Encoding: chunked\r\n");
  client.write("\r\n");

  // 2. 意図的な遅延を伴うチャンクの送信
  // ネットワークの遅延やTCPのフラグメンテーション（パケット分割）をシミュレートします

  setTimeout(() => {
    console.log("[Client] Sending chunk 1...");
    // 16進数で '7' バイトのデータ
    client.write("7\r\nNode.js\r\n");
  }, 1000);

  setTimeout(() => {
    console.log("[Client] Sending chunk 2...");
    // 16進数で 'B' (11) バイトのデータ
    client.write("B\r\n is awesome\r\n");
  }, 2000);

  setTimeout(() => {
    console.log("[Client] Sending terminating chunk...");
    // 終端を示すサイズ0のチャンク
    client.write("0\r\n\r\n");
  }, 3000);
});

client.on("data", (data) => {
  console.log("\n[Client] Received response from server:");
  console.log(data.toString("utf-8"));
  client.end();
});

client.on("end", () => {
  console.log("[Client] Disconnected from server.");
});

client.on("error", (err) => {
  console.error("[Client] Error:", err);
});
