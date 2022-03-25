import React from "react";
import "./styles.css";
import {User} from "./models";
import Header from "./header";
import {getConsentedUsers} from "./api";
import {DataGrid} from '@mui/x-data-grid';
import {Link} from "react-router-dom";

interface UsersComponentState {
    users: Array<User & { lastMemory: number, totalMemories: number }>
}

export default class Users extends React.Component<{}, UsersComponentState> {
    state = {
        users: undefined
    };

    componentDidMount() {
        getConsentedUsers().then(response => this.setState({users: response.data || []}))
    }

    render() {
        const {users} = this.state as UsersComponentState;
        return (
            <>
                <Header/>
                <DataGrid
                    getRowId={row => row.userId}
                    rows={users}
                    columns={[
                        {
                            renderCell: (params) => <Link
                                to={'/memories?user=' + params.row.userId}>{params.value}</Link>,
                            field: 'name',
                            width: 200,
                        },
                        {
                            field: 'lastmemory',
                            renderCell: (params => params.value ? new Date(params.value * 1000).toLocaleString() : '-'),
                            headerName: 'Останній спогад',
                            width: 200,
                        },
                        {
                            field: 'totalmemories',
                            headerName: "Всього спогадів",
                            type: "number",
                            renderCell: params => params.row.lastmemory ? params.value : 0,
                            width: 150
                        }
                    ]}
                />
            </>
        );
    }
}
