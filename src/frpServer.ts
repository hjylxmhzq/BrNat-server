import { frpServerConfig } from './config/base';
import * as net from 'net';

enum Action {
    LINK_REGIST = 'LINK_REGIST',
    LINK_REGIST_RESPONSE = 'LINK_REGIST_RESPONSE',
    ADD_BIND = 'ADD_BIND',
    DATA_SOCKET = 'DATA_SOCKET',
    TUNNEL_CONNECT = 'TUNNEL_CONNECT',
    ERR_TOKEN = 'ERR_TOKEN'
}

interface ILocalBind {
    port: number;
    host: string;
    remotePort: number;
}

interface ILocalBinds {
    [label: string]: ILocalBind;
}

interface IProxyConfig {
    bindPort: number;
    bindAddr: string;
    restartDelay: number; // ms
    token: string;
    portRange: number[];
}



interface ILinkBinds {
    [bindPort: number]: {
        token: string;
        label: string;
        id: string;
        localPort: number;
        localHost: string;
        remotePort: number;
        proxySockets: {
            [remoteHost_remotePort: string]: {
                tunnelSocket: net.Socket,
                clientSocket: net.Socket,
            }
        }
        linkSocket: net.Socket;
    }
}

interface ILinkCommand {
    regist: (label: string, remotePort: number) => string;
    connect: (label: string, clientSymbol: string) => string;
    errToken: () => string;
}

interface IClientServers {
    [port: number]: { server: net.Server, sockets: Set<net.Socket> };
}

const END_OF_COMMAND = "END_OF_COMMAND";

class TCPProxyServer {
    private config: IProxyConfig;
    private linkBinds: ILinkBinds = {};
    private command: ILinkCommand;
    private clientServers: IClientServers = {};
    private linkServer: net.Server;
    private accessTokens: string[] = [];
    private registedPort: Set<number> = new Set();
    private commandCache: string = '';
    private linkSocket: Map<string, net.Socket> = new Map();

    constructor(config: IProxyConfig) {
        this.config = config;
        this.command = {
            regist: (label, remotePort) =>
                this.controlDataFac(Action.ADD_BIND, label, { remotePort }),
            connect: (label: string, clientSymbol: string) =>
                this.controlDataFac(Action.DATA_SOCKET, label, { clientSymbol }),
            errToken: () => this.controlDataFac(Action.ERR_TOKEN, '', {})
        }
    }

    private controlDataFac(action: string, label: string, rest: object) {
        return JSON.stringify({ action, label, ...rest }) + END_OF_COMMAND;
    }

    private parseCommand(chunk: Buffer) {
        this.commandCache += chunk.toString();
        if (!this.commandCache.endsWith(END_OF_COMMAND)) {
            return null;
        }
        try {
            const cmList = chunk.toString().split(END_OF_COMMAND).filter(cmstr => !!cmstr).map(cmstr => JSON.parse(cmstr));
            this.commandCache = '';
            return cmList;
        } catch (e) {
            console.error(e);
        }
        return null;
    }
    private generateLinkId(label: string, socket: net.Socket, bindPort: number) {
        return `${label}_${socket.remoteAddress}_${socket.remotePort}_${bindPort}`;
    }
    private createBindPort() {
        let p = this.config.portRange[0];
        for (; p < this.config.portRange[1]; p++) {
            if (!this.registedPort.has(p)) {
                break;
            }
        }
        if (p === this.config.portRange[1]) {
            return -1;
        }
        this.registedPort.add(p);
        return p;
    }
    private createClientServer(bindPort: number) {
        if (this.clientServers[bindPort]) {
            this.clientServers[bindPort].server.close();
            this.clientServers[bindPort].sockets && this.clientServers[bindPort].sockets.forEach(socket => {
                socket.end();
            })
        }
        const clientServer = net.createServer(socket => {
            this.clientServers[bindPort].sockets.add(socket);
            socket.on('error', console.error);
            const clientSymbol = `${socket.remoteAddress}_${socket.remotePort}`;
            if (this.linkBinds[socket.localPort]) {
                this.linkBinds[socket.localPort].proxySockets[clientSymbol] = {
                    clientSocket: socket,
                    tunnelSocket: null,
                }
                this.linkBinds[socket.localPort].linkSocket.write(this.command.connect(this.linkBinds[socket.localPort].label, clientSymbol))
            }
        });
        clientServer.on('close', () => {
            this.registedPort.delete(bindPort);
            this.clientServers[bindPort] = null;
        })
        clientServer.on('error', () => {
            this.registedPort.delete(bindPort);
            this.clientServers[bindPort] = null;
        })
        this.clientServers[bindPort] = { server: clientServer, sockets: new Set() };
        clientServer.on('error', console.error);
        clientServer.listen(bindPort, this.config.bindAddr);
        console.log(`listening on ${bindPort}`);
    }
    private removeRelativeBoundPort(socket: net.Socket) {
        try {
            Object.keys(this.linkBinds).forEach(key => {
                if (this.linkBinds[key].linkSocket === socket) {
                    Object.values(this.linkBinds[key].proxySockets).forEach((ps: any) => {
                        ps.tunnelSocket && ps.tunnelSocket.end();
                        ps.clientSocket && ps.clientSocket.end();
                    })
                    delete this.linkBinds[key];
                }
                this.clientServers[key] && this.clientServers[key].server.close();
                this.clientServers[key] && this.clientServers[key].sockets && this.clientServers[key].sockets.forEach(socket => {
                    socket.end();
                })
            })
        } catch (e) {
            console.error(e);
        }
    }
    private linkAddBind(socket: net.Socket, cm: any) {
        const remotePort = this.createBindPort();
        socket.write(this.command.regist(cm.label, remotePort));
        this.linkBinds[remotePort] = {
            token: cm.token,
            label: cm.label,
            id: this.generateLinkId(cm.label, socket, remotePort),
            localPort: cm.bind.port,
            localHost: cm.bind.host,
            remotePort: remotePort,
            linkSocket: socket,
            proxySockets: {}
        }
        console.log(`bind port: ${remotePort} | label: ${cm.label} | host: ${cm.bind.host} | port: ${cm.bind.port}`);
        this.createClientServer(remotePort);
    }
    private linkTunnelConnect(socket: net.Socket, cm: any) {
        const clientSymbol = cm.clientSymbol;
        console.log('client symbol:', clientSymbol)
        const tunnelSocket = socket;
        this.linkBinds[cm.bind.remotePort].proxySockets[clientSymbol].tunnelSocket = tunnelSocket;
        const clientSocket = this.linkBinds[cm.bind.remotePort].proxySockets[clientSymbol].clientSocket;
        // tunnelSocket.on('data', chunk => {
        //     clientSocket.write(chunk);
        // });
        // clientSocket.on('data', chunk => {
        //     tunnelSocket.write(chunk);
        // })
        tunnelSocket.pipe(clientSocket);
        clientSocket.pipe(tunnelSocket);
        tunnelSocket.on('end', () => {
            console.log('tunnel connection end');
        });
        clientSocket.on('end', () => {
            tunnelSocket.end();
            console.log('client connection end');
        });
    }
    private createLinkServer() {
        this.linkServer = net.createServer(socket => {
            socket.once('error', console.error);
            socket.once('data', chunk => {
                try {
                    const cmList = this.parseCommand(chunk);
                    while (cmList && cmList.length) {
                        const cm = cmList.shift();
                        console.log('-------------------- COMMAND ---------------------')
                        console.log(cm);
                        console.log('-------------------- CMD_END ---------------------')
                        if (!cm.token || this.accessTokens.indexOf(cm.token) === -1) {
                            socket.write(this.command.errToken());
                            socket.end();
                            return;
                        }
                        if (cm.action === Action.LINK_REGIST) {
                            socket.on('close', () => {
                                this.removeRelativeBoundPort(socket);
                            })
                            socket.on('error', () => {
                                this.removeRelativeBoundPort(socket);
                            })
                            socket.on('data', chunk => {
                                // 监听link的控制信息
                                try {
                                    const cmList = this.parseCommand(chunk);
                                    while (cmList && cmList.length) {
                                        const cm = cmList.shift();
                                        console.log('-------------------- LINK_COMMAND ---------------------')
                                        console.log(cm);
                                        console.log('-------------------- CMD_END ---------------------')
                                        if (cm && cm.action === Action.ADD_BIND) {
                                            this.linkAddBind(socket, cm);
                                        } else if (cm && cm.action === Action.TUNNEL_CONNECT) {
                                            this.linkTunnelConnect(socket, cm);
                                        }
                                    }
                                } catch (e) {
                                    console.error(e);
                                }
                            })
                        } else if (cm && cm.action === Action.TUNNEL_CONNECT) {
                            this.linkTunnelConnect(socket, cm);
                        } else if (cm && cm.action === Action.ADD_BIND) {
                            this.linkAddBind(socket, cm);
                        }
                    }
                } catch (e) {
                    console.error(e);
                }
            });
        });

        this.linkServer.listen(this.config.bindPort, this.config.bindAddr);
        this.linkServer.on('close', () => {
            this.linkServer = null;
        });
        this.linkServer.on('error', () => {
            this.linkServer = null;
        });
        console.log(`server is listening on ${this.config.bindAddr}:${this.config.bindPort}`);
    }
    addToken(token: string) {
        this.accessTokens.push(token);
    }
    getBindsByToken(token: string) {
        const binds = Object.values(this.linkBinds).filter(bind => bind.token === token);
        const infos = binds.map(bind => ({
            online: bind.linkSocket,
            label: bind.label,
            localPort: bind.localPort,
            remotePort: bind.remotePort,
            localHost: bind.localHost,
        }));
        return infos;
    }
    serve(autoRestart: boolean = true) {
        this.createLinkServer();
        autoRestart && global.setInterval(() => {
            !this.linkServer && this.createLinkServer();
        }, 1000)
    }
}

const server = new TCPProxyServer(frpServerConfig);

server;

export {
    server
}