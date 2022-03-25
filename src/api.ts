import axios from "axios";
import {Memory, User} from "./models";

export function getMemories() {
    return axios.get<Memory[]>("/api/memories?user=" + new URLSearchParams(window.location.search).get('user'))
}

export function getConsentedUsers() {
    return axios.get<Array<User & { lastMemory: number, totalMemories: number }>>("/api/consented-users")
}
