/**
 * Shared outer shell for all transactional emails.
 * Drop the rendered <main> block in — every template gets consistent
 * header, footer, and brand styling for free.
 *
 * To restyle all emails at once: edit this file only.
 */
export function baseLayout(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>X Socials</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">

          <!-- Header -->
          <tr>
            <td style="padding:0 0 24px">
              <span style="font-size:22px;font-weight:700;color:#111;letter-spacing:-.5px">X Socials</span>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#fff;border-radius:10px;padding:40px;box-shadow:0 1px 6px rgba(0,0,0,.07)">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 0 0;text-align:center;font-size:12px;color:#aaa;line-height:1.6">
              You received this email because an action was taken on your X Socials account.<br>
              If you did not request this, you can safely ignore this email.
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
