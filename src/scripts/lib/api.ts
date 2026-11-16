import ky from 'ky'

export const api = ky.create({
  timeout: 10000
})

export default api
