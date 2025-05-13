// Modules to control application life and create native browser window
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const dirGeojson = path.join(__dirname, 'geojson');

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

//import { transform } from './node_modules/ol/proj';

function createWindow() {
    // Create the browser window.
    mainWindow = new BrowserWindow({
        titleBarStyle: 'hidden',
        width: 1200,
        height: 800,
        backgroundColor: '#ffffff',
        icon: path.join(__dirname, 'favicon.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });
    mainWindow.setMenu(null);

    //mainWindow.setFullScreen(true);
    //mainWindow.setSimpleFullScreen(true);

    mainWindow.maximize();

    // and load the index.html of the app.
    mainWindow.loadFile('index.html');

    // Development tools
    if (process.env.NODE_ENV === 'development') {
        mainWindow.webContents.openDevTools();
    }

    // Emitted when the window is closed.
    mainWindow.on('closed', function() {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        mainWindow = null;
    });

    // IPC handlers
    ipcMain.handle('getGeojsonFiles', async () => {
        try {
            const files = await fs.promises.readdir(dirGeojson);
            return { files };
        } catch (err) {
            console.error('Error reading directory:', err);
            throw new Error('Unable to scan directory');
        }
    });

    ipcMain.handle('saveGeocodingResults', async (event, data) => {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `geocoding-results-${timestamp}.json`;
            const filepath = path.join(dirGeojson, filename);
            await fs.promises.writeFile(filepath, JSON.stringify(data, null, 2));
            return { success: true, filename };
        } catch (err) {
            console.error('Error saving results:', err);
            throw new Error('Unable to save results');
        }
    });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', function() {
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function() {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWindow === null) createWindow();
});