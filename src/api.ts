import axios from "axios";

export function getMemories() {
    return axios.get("/memories", this.authRequestConfig())
}

export function authRequestConfig() {
    return {headers: {Authorization: `Bearer ${window.localStorage.getItem('auth')}`}}
}
