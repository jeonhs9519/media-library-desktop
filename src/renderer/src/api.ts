import type { API } from '../../preload/index'

export const api = (window as Window & { api: API }).api
