import net from "node:net";
import { Buffer } from "node:buffer";
import { parseHeaders } from "../parseHeaders.js";
import { handleRequest } from "../handleRequest.js";

const server = net.createServer((socket) => {
  console.log("Client connected");

  let buffer = Buffer.alloc(0);
  let parsingState = "HEADERS";
  let currentHeaders = null;

  // Content-Length用
  let expectedContentLength = 0;

  // Chunked Encoding 用
  let isChunked = false;
  let chunkedBodyBuffer = Buffer.alloc(0);
  let currentChunkSize = 0;

  socket.setTimeout(5000);
  socket.on("timeout", () => {
    socket.end();
  });

  socket.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    processBuffer();
  });

  function processBuffer() {
    while (true) {
      if (parsingState === "HEADERS") {
        const boundaryIndex = buffer.indexOf("\r\n\r\n");
        if (boundaryIndex === -1) return;

        const headerString = buffer
          .subarray(0, boundaryIndex)
          .toString("utf-8");
        currentHeaders = parseHeaders(headerString);

        const te = currentHeaders["transfer-encoding"]?.toLowerCase();
        const cl = currentHeaders["content-length"];

        if (te && cl) {
          socket.write(
            "HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\nInvalid Headers: Both Transfer-Encoding and Content-Length present.",
          );
          socket.end();
          return;
        }

        buffer = buffer.subarray(boundaryIndex + 4);

        if (te === "chunked") {
          isChunked = true;
          chunkedBodyBuffer = Buffer.alloc(0);
          parsingState = "BODY_CHUNK_SIZE";
        } else {
          isChunked = false;
          expectedContentLength = parseInt(cl || "0", 10);
          parsingState = "BODY_CL";
        }
      }

      // =============================================
      // フェーズ2-A: Content-Lengthに基づくボディ受信
      // =============================================
      if (parsingState === "BODY_CL") {
        if (buffer.length < expectedContentLength) return;

        const bodyData = buffer.subarray(0, expectedContentLength);
        buffer = buffer.subarray(expectedContentLength);

        finishRequest(bodyData);
        if (buffer.length === 0) break;
      }

      // ===============================================
      // フェーズ2-B: チャンク転送エンコーディングの受信
      // ===============================================
      if (parsingState === "BODY_CHUNK_SIZE") {
        const crlfIndex = buffer.indexOf("\r\n");
        if (crlfIndex === -1) return;

        const sizeHex = buffer.subarray(0, crlfIndex).toString("utf-8");
        currentChunkSize = parseInt(sizeHex, 16);

        if (isNaN(currentChunkSize)) {
          socket.write(
            "HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\nInvalid Chunk Size.",
          );
          socket.end();
          return;
        }

        buffer = buffer.subarray(crlfIndex + 2);

        if (currentChunkSize === 0) {
          parsingState = "BODY_CHUNK_TRAILER";
        } else {
          parsingState = "BODY_CHUNK_DATA";
        }
      }

      if (parsingState === "BODY_CHUNK_DATA") {
        if (buffer.length < currentChunkSize + 2) return;

        const chunkData = buffer.subarray(0, currentChunkSize);
        chunkedBodyBuffer = Buffer.concat([chunkedBodyBuffer, chunkData]);

        buffer = buffer.subarray(currentChunkSize + 2);
        parsingState = "BODY_CHUNK_SIZE";
      }

      if (parsingState === "BODY_CHUNK_TRAILER") {
        const crlfIndex = buffer.indexOf("\r\n");
        if (crlfIndex === -1) return;

        buffer = buffer.subarray(crlfIndex + 2);

        finishRequest(chunkedBodyBuffer);
        if (buffer.length === 0) break;
      }
    }
  }

  function finishRequest(bodyData) {
    handleRequest(currentHeaders, bodyData, socket);

    const connectionHeader = (currentHeaders["connection"] || "").toLowerCase();
    if (connectionHeader === "close") {
      socket.end();
    }

    parsingState = "HEADERS";
    currentHeaders = null;
    isChunked = false;
    chunkedBodyBuffer = Buffer.alloc(0);
    currentChunkSize = 0;
  }

  socket.on("end", () => {
    console.log("Client disconnected");
  });

  socket.on("error", (err) => {
    console.log("Socket error:", err);
  });
});

server.listen(8080, () => {
  console.log("TCP Server running on port 8080");
});
