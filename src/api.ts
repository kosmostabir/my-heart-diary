import axios from "axios";
import {Memory, User} from "./models";

export function getMemories() {
    const queryUser = new URLSearchParams(window.location.search).get('user');
    return axios.get<Memory[]>('/api/memories' + queryUser ? '?user=' + queryUser : '')
}

export function getConsentedUsers() {
    return axios.get<Array<User & { lastMemory: number, totalMemories: number }>>("/api/consented-users")
}
