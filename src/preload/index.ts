import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('nextdj', {
  appName: 'NextDJ'
})
