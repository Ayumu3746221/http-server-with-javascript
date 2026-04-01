# Local Development Private PKI (Public Key Infrastructure) Setup

本プロジェクトでは、ローカル環境（`localhost`）においてセキュリティ警告（`curl -k` やブラウザのエラー）をバイパスすることなく、本番環境と同一の厳密なTLS/HTTPS通信を検証するために、プライベートな認証局（Root CA）を設立してサーバー証明書を発行しています。

## 構築手順

証明書の生成には `openssl` コマンドを使用します。作業ディレクトリ（例: `certificate/`）を作成し、以下の手順を順番に実行してください。

### Phase 1: ルート認証局（Root CA）の設立

すべての信頼の起点となる、あなた専用のルート認証局を構築します。

**1. ルート認証局の秘密鍵を生成 (RSA 4096bit)**

```bash
openssl genrsa -out rootCA.key 4096
```

**2. ルート認証局のルート証明書を生成 (有効期限10年)**

```bash
openssl req -x509 -new -nodes -key rootCA.key -sha256 -days 3650 -out rootCA.crt -subj "/C=JP/O=My Local CA/CN=My Local Root CA"
```

> **Note:** 生成された `rootCA.crt` は、後ほどクライアント（OS/ブラウザ）に「信頼できる認証機関」として登録するためのファイルです。サーバー側には配置しません。

---

### Phase 2: サーバー証明書の発行と署名

Node.jsサーバーが自身の身元を証明するための鍵と証明書を作成し、Phase 1で設立したルートCAの権限で署名を行います。

**3. サーバー用の秘密鍵を生成 (RSA 2048bit)**

```bash
openssl genrsa -out server.key 2048
```

**4. 証明書署名要求（CSR: Certificate Signing Request）を作成**

```bash
openssl req -new -key server.key -out server.csr -subj "/C=JP/O=Localhost Server/CN=localhost"
```

**5. SAN (Subject Alternative Name) 定義ファイルの作成**

現代のTLS標準仕様（RFC 6125）では、Common Name (CN) によるドメイン検証は非推奨です。確実に `localhost` を証明するため、拡張領域（SAN）を定義する `san.ext` ファイルを作成します。

```bash
echo "authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage = digitalSignature, nonRepudiation, keyEncipherment, dataEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
IP.1 = 127.0.0.1" > san.ext
```

**6. サーバー証明書の発行（ルートCAによる署名）**

```bash
openssl x509 -req -in server.csr -CA rootCA.crt -CAkey rootCA.key -CAcreateserial -out server.crt -days 365 -sha256 -extfile san.ext
```

> **Note:** これでNode.jsサーバーに読み込ませる `server.key` と `server.crt` が完成しました。

---

### Phase 3: クライアントOSへのルートCAの登録（macOS用）

発行したサーバー証明書をOSレベルで信頼させるため、ルート証明書をシステムキーチェーンに登録します。

```bash
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain rootCA.crt
```

> **Note:** この操作により、`curl` (システム証明書ストアを参照するもの) や Safari, Chrome などのブラウザから `https://localhost:8080/` へアクセスした際、中間者攻撃のリスクがない安全な通信として承認されます。

---

## 参考文献・標準仕様 (References)

本PKI構築のアーキテクチャおよびコマンドパラメータは、以下の国際標準化機関の仕様に基づいています。

* **IETF RFC 5280**: Internet X.509 Public Key Infrastructure Certificate and Certificate Revocation List (CRL) Profile (SAN拡張の適用ルール)
* **IETF RFC 6125**: Representation and Verification of Domain-Based Application Service Identity (CNの非推奨化とSANの必須化)
* **IETF RFC 8446**: The Transport Layer Security (TLS) Protocol Version 1.3
