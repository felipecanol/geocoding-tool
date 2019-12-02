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
        width: 700,
        height: 500,
        backgroundColor: '#ffffff',
        modal: true,
        icon: path.join(__dirname, 'favicon.png'),
        webPreferences: {
            nodeIntegration: true
        }
    });
    mainWindow.setMenu(null);

    //mainWindow.setFullScreen(true);
    //mainWindow.setSimpleFullScreen(true);

    mainWindow.maximize();

    // and load the index.html of the app.
    mainWindow.loadFile('index.html');

    // Open the DevTools.
    //mainWindow.webContents.openDevTools();

    // Emitted when the window is closed.
    mainWindow.on('closed', function() {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        mainWindow = null;
    });

    ipcMain.on('getGeojsonFiles', (evt) => {
        fs.readdir(dirGeojson, function(err, files) {
            //handling error
            if (err) {
                return console.log('Unable to scan directory: ' + err);
            }
            evt.sender.send('getGeojsonFiles-response', { files });
        });
    });

}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

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