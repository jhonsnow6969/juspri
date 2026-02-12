# Steps to Test the Prototype

1. **Download Ngrok**Download Ngrok from [ngrok.com](https://ngrok.com), unzip it, and double-click to run it.
2. **Open the Tunnel**Open a terminal/command prompt and run this command:

   ```
   ngrok tcp <PRINTER_IP>:9100
   ```

   (Replace `<PRINTER_IP>` with the printer's local IP, e.g., `192.168.1.15`.)
3. **Send the Address**Ngrok will display a line like:

   ```
   Forwarding tcp://0.tcp.ngrok.io:15492 -> ...
   ```

   Note the IP and port values (e.g., `0.tcp.ngrok.io` and `15492`).
4. **Generate a QR Code**Use a JSON to QR code generator like [https://qr.munb.me/json-qr?lang=en](https://qr.munb.me/json-qr?lang=en).Input the following JSON:

   ```json
   {
     "ssid": "Remote_Test",
     "ip": "0.tcp.ngrok.io",
     "port": 15492
   }
   ```
5. **The Test**
   Visit [https://qr-wifi-printer.vercel.app/](https://qr-wifi-printer.vercel.app/) and scan the QR code to test.

## Base Workflow

Phone → [https://qr-wifi-printer.vercel.app/](https://qr-wifi-printer.vercel.app/) (Vercel) → [https://justpri.duckdns.org](https://justpri.duckdns.org) (Oracle Caddy) → localhost:3001 (Oracle Node) → Ngrok Tunnel → Laptop → Printer.

## Dev Repo Link to Run Locally

[https://github.com/revanthlol/qr-wifi-printer](https://github.com/revanthlol/qr-wifi-printer)
