import { contextBridge, ipcRenderer, webUtils } from 'electron'

const api = {
  items: {
    getAll: (params?: any) => ipcRenderer.invoke('items:getAll', params),
    getById: (id: number) => ipcRenderer.invoke('items:getById', { id }),
    add: (data: any) => ipcRenderer.invoke('items:add', data),
    update: (id: number, fields: any) => ipcRenderer.invoke('items:update', { id, ...fields }),
    delete: (id: number) => ipcRenderer.invoke('items:delete', { id }),
    relink: (id: number, newFilePath: string) => ipcRenderer.invoke('items:relink', { id, newFilePath }),
    countByFolderPrefix: (folderPath: string) => ipcRenderer.invoke('items:countByFolderPrefix', { folderPath }),
    bulkRelinkFolder: (fromFolder: string, toFolder: string) =>
      ipcRenderer.invoke('items:bulkRelinkFolder', { fromFolder, toFolder }),
    checkExists: (filePath: string, fileName: string, fileExtension: string) =>
      ipcRenderer.invoke('items:checkExists', { filePath, fileName, fileExtension }),
    importHdtPreview: (filePaths: string[]) => ipcRenderer.invoke('items:importHdtPreview', { filePaths }),
    importHdtApply: (selectedIds: string[]) => ipcRenderer.invoke('items:importHdtApply', { selectedIds }),
    fillMissingMetadata: () => ipcRenderer.invoke('items:fillMissingMetadata'),
    getMetadataFillStatus: () => ipcRenderer.invoke('items:getMetadataFillStatus'),
  },
  thumbnail: {
    get: (id: number) => ipcRenderer.invoke('thumbnail:get', { id }),
    setFromPage: (id: number, pageIndex: number) => ipcRenderer.invoke('thumbnail:setFromPage', { id, pageIndex }),
    setFromTime: (id: number, timeSeconds: number) => ipcRenderer.invoke('thumbnail:setFromTime', { id, timeSeconds }),
    setFromImageData: (id: number, base64: string) => ipcRenderer.invoke('thumbnail:setFromImageData', { id, base64 }),
  },
  tags: {
    getAll: () => ipcRenderer.invoke('tags:getAll'),
    create: (name: string) => ipcRenderer.invoke('tags:create', { name }),
    delete: (id: number) => ipcRenderer.invoke('tags:delete', { id }),
    assignToItem: (itemId: number, tagId: number) => ipcRenderer.invoke('tags:assignToItem', { itemId, tagId }),
    removeFromItem: (itemId: number, tagId: number) => ipcRenderer.invoke('tags:removeFromItem', { itemId, tagId }),
  },
  reviews: {
    upsert: (itemId: number, rating: number, comment?: string) =>
      ipcRenderer.invoke('reviews:upsert', { itemId, rating, comment }),
  },
  settings: {
    get: (key: string) => ipcRenderer.invoke('settings:get', { key }),
    set: (key: string, value: string) => ipcRenderer.invoke('settings:set', { key, value }),
  },
  file: {
    openDialog: (filters?: Electron.FileFilter[]) => ipcRenderer.invoke('file:open-dialog', { filters }),
    openFolderDialog: () => ipcRenderer.invoke('file:open-folder-dialog'),
    checkExists: (filePath: string) => ipcRenderer.invoke('file:check-exists', { filePath }),
    readStat: (filePath: string) => ipcRenderer.invoke('file:read-stat', { filePath }),
    openExternal: (filePath: string) => ipcRenderer.invoke('file:open-external', { filePath }),
    getPathForFile: (file: any) => webUtils.getPathForFile(file),
  },
  pdf: {
    load: (filePath: string) => ipcRenderer.invoke('pdf:load', { filePath }),
    readFile: (filePath: string) => ipcRenderer.invoke('pdf:readFile', { filePath }),
  },
  cbz: {
    getPages: (filePath: string) => ipcRenderer.invoke('cbz:getPages', { filePath }),
    getPage: (filePath: string, pageIndex: number) => ipcRenderer.invoke('cbz:getPage', { filePath, pageIndex }),
  },
  video: {
    getLocalUrl: (filePath: string) => ipcRenderer.invoke('video:getLocalUrl', { filePath }),
  },
  app: {
    reload: () => ipcRenderer.invoke('app:reload'),
    toggleDevTools: () => ipcRenderer.invoke('app:toggleDevTools'),
    zoomIn: () => ipcRenderer.invoke('app:zoomIn'),
    zoomOut: () => ipcRenderer.invoke('app:zoomOut'),
    zoomReset: () => ipcRenderer.invoke('app:zoomReset'),
  },
}

contextBridge.exposeInMainWorld('api', api)

export type API = typeof api
