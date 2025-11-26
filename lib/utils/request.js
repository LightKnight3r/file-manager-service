const axios = require("axios")

module.exports = {
  get: (url, params) => {
    const options = {
      method: "get",
      url,
      params,
      timeout: 3000
    }
    return axios(options).then(res => res.data)
  },
  post: (url, data) => {
    const options = {
      method: "post",
      url,
      data,
      timeout: 3000
    }
    return axios(options).then(res => res.data)
  }
}
