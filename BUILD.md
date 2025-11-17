# Build Instructions

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Windows OS (for building Windows installer)

## Development

Run the application in development mode:

```bash
npm run dev
```

Or start normally:

```bash
npm start
```

## Building for Production

### Build Windows Installer

Build a complete Windows installer (NSIS):

```bash
npm run build
```

Or specifically for Windows:

```bash
npm run build:win
```

### Build Directory Only (No Installer)

Build the application without creating an installer:

```bash
npm run build:dir
```

Or use the pack command:

```bash
npm run pack
```

## Build Output

The built application will be located in the `dist/` directory:

- `dist/Group Policy Manager-1.0.0-Setup.exe` - Windows installer
- `dist/win-unpacked/` - Unpacked application files

## Application Icon (Optional)

The application will build with the default Electron icon. To use a custom icon:

1. Create or obtain an ICO file with multiple sizes (16x16, 32x32, 48x48, 256x256)
2. Save it as `build/icon.ico`
3. Uncomment the icon lines in package.json under the `win` and `nsis` sections

## Administrator Privileges

The application is configured to request administrator privileges on launch via the `requestedExecutionLevel: "requireAdministrator"` setting. This ensures the app can modify Windows Group Policy settings.

## Notes

- The application requires Windows OS to run
- Administrator privileges are mandatory for policy modifications
- The installer allows users to choose the installation directory
- Desktop and Start Menu shortcuts are created automatically
