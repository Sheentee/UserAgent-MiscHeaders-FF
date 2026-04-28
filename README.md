# UserAgent & Misc Headers

A simple browser extension that allows you to modify the User-Agent string and inject custom headers into HTTP requests on a per-tab basis.

## Features

- Modify User-Agent: Change the User-Agent string for all requests in an active tab.
- Custom Headers: Add and manage multiple custom headers to be injected into requests.
- Per-Tab Activation: Enable or disable header modification independently for each tab.
- Reset to Default: Quickly reset the User-Agent to your browser's default string.
- Persistent Settings: Your custom headers and User-Agent configuration are saved automatically.

## Installation

### Chrome Web Store

https://chromewebstore.google.com/detail/useragent-misc-headers/pkpalijcjebnhaiegeecfjpbohohkhfl

### Firefox Browser Add-ons

https://addons.mozilla.org/en-US/firefox/addon/useragent-misc-headers/

### Manual Installation

1. Clone this repository or download the source code as a ZIP file and extract it.
2. Open your browser and navigate to the extensions management page:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
   - Brave: `brave://extensions`
3. Enable "Developer mode" using the toggle in the top right corner.
4. Click the "Load unpacked" button.
5. Select the directory containing the extension files (where `manifest.json` is located).

## Usage

1. Click the extension icon in your browser toolbar to open the popup.
2. Enter the desired User-Agent string in the text area.
3. Add any custom headers by providing a name and value, then clicking "Add Header".
4. Use the "Enable for this tab" toggle to activate the modifications for the current tab.
5. The status indicator will show "Active" when the modifications are being applied.

## License

This project is licensed under the Creative Commons 0 (CC0) 1.0 Universal license. See the [LICENSE](LICENSE) file for details.
