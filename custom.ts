declare class WebSocket {
    constructor(url: string);
    readyState: number;
    send(data: string): void;
    close(): void;
    onopen: () => void;
    onmessage: (ev: any) => void;
    onclose: () => void;
    onerror: (err: any) => void;
}

declare class EventSource {
    constructor(url: string);
    close(): void;
    onmessage: (ev: any) => void;
    onerror: (err: any) => void;
}

declare function setTimeout(handler: () => void, timeout: number): number;
declare const JSON: any;
declare const fetch: any;

//% color="#5a5cff" icon="\uf233" weight=100 block="EnderNet"
namespace Endernet {

    export let currentWorldId = "default_world";
    export let httpBaseUrl = "";

    export let ws: WebSocket = null;
    export let clientId = "";

    export let lastReceivedMessage = "";
    export let lastReceivedSender = "";
    export let lastJoinedPlayer = "";
    export let lastLeftPlayer = "";
    export let lastPearlData = "";
    export let lastPearlError = "";

    let wsMsgHandler: () => void = null;
    let wsJoinHandler: () => void = null;
    let wsLeaveHandler: () => void = null;
    let pearlStreamHandler: () => void = null;
    let pearlErrorHandler: () => void = null;

    let pearlSource: EventSource = null;

    //% block="connect secure EnderNet on server %hostUrl"
    //% blockNamespace="EnderNet"
    //% hostUrl.defl="https://endernet-server-273220767084.europe-west1.run.app"
    //% weight=100
    export function initSecureSession(hostUrl: string): void {
        httpBaseUrl = hostUrl;

        httpPost("/api/auth/request-code", "{}", function (body: string, status: number) {
            if (status === 200) {
                const res = JSON.parse(body);
                const code = res.code;
                const claimUrl = res.claimUrl;

                player.say("§d[EnderNet] Pairing code required!");
                player.say("§eLink your MEE identity here:");
                player.say("§b" + claimUrl);
                player.say("§7Pairing Code: §f" + code);

                let isHandshakeComplete = false;

                function pollStatus() {
                    if (isHandshakeComplete) return;

                    httpGet("/api/auth/status/" + code, function (statusBody: string, sStatus: number) {
                        if (sStatus === 200 && !isHandshakeComplete) {
                            const sessionData = JSON.parse(statusBody);
                            if (sessionData.status === "claimed") {
                                isHandshakeComplete = true;
                                const realTag = sessionData.verifiedGamertag;
                                const world = sessionData.worldId;

                                player.say("§a[EnderNet] Verified as §f" + realTag + " §ain world §f" + world);

                                const wsUrl = hostUrl.replace("https://", "wss://").replace("http://", "ws://");
                                wsConnect(wsUrl, realTag, world);
                                return;
                            }
                        }

                        if (!isHandshakeComplete) {
                            setTimeout(pollStatus, 3000);
                        }
                    });
                }

                setTimeout(pollStatus, 3000);
            } else {
                player.say("§c[EnderNet] Server unreachable.");
            }
        });
    }

    //% block="broadcast message %msg"
    //% blockNamespace="EnderNet"
    //% msg.defl="Hello from MakeCode!"
    //% weight=90
    export function wsSend(msg: string): void {
        if (ws && ws.readyState === 1) {
            ws.send(JSON.stringify({
                type: "chat",
                worldId: currentWorldId,
                from: clientId,
                message: msg
            }));
        }
    }

    //% block="on message received"
    //% blockNamespace="EnderNet"
    //% weight=85
    export function onMessageReceived(handler: () => void): void {
        wsMsgHandler = handler;
    }

    //% block="last received message"
    //% blockNamespace="EnderNet"
    //% weight=84
    export function getLastMessage(): string {
        return lastReceivedMessage;
    }

    //% block="last received sender"
    //% blockNamespace="EnderNet"
    //% weight=83
    export function getLastSender(): string {
        return lastReceivedSender;
    }

    //% block="on player joined"
    //% blockNamespace="EnderNet"
    //% weight=80
    export function onPlayerJoined(handler: () => void): void {
        wsJoinHandler = handler;
    }

    //% block="last joined player"
    //% blockNamespace="EnderNet"
    //% weight=79
    export function getLastJoinedPlayer(): string {
        return lastJoinedPlayer;
    }

    //% block="on player left"
    //% blockNamespace="EnderNet"
    //% weight=75
    export function onPlayerLeft(handler: () => void): void {
        wsLeaveHandler = handler;
    }

    //% block="last left player"
    //% blockNamespace="EnderNet"
    //% weight=74
    export function getLastLeftPlayer(): string {
        return lastLeftPlayer;
    }

    //% block="throw Pearl stream to world %worldId"
    //% blockNamespace="EnderNet"
    //% weight=70
    export function pearlThrow(worldId: string): void {
        if (pearlSource) pearlSource.close();

        const hasSlash = httpBaseUrl.charAt(httpBaseUrl.length - 1) === "/";
        const streamUrl = hasSlash
            ? httpBaseUrl + "pearl/stream/" + worldId
            : httpBaseUrl + "/pearl/stream/" + worldId;

        pearlSource = new EventSource(streamUrl);

        pearlSource.onmessage = function (ev: any) {
            lastPearlData = ev.data;
            if (pearlStreamHandler) pearlStreamHandler();
        };

        pearlSource.onerror = function (err: any) {
            lastPearlError = "Endermite spawned: Stream error";
            if (pearlErrorHandler) pearlErrorHandler();
        };
    }

    //% block="on Pearl stream hit"
    //% blockNamespace="EnderNet"
    //% weight=65
    export function onPearlHit(handler: () => void): void {
        pearlStreamHandler = handler;
    }

    //% block="last Pearl data"
    //% blockNamespace="EnderNet"
    //% weight=64
    export function getLastPearlData(): string {
        return lastPearlData;
    }

    //% block="on Endermite (stream error)"
    //% blockNamespace="EnderNet"
    //% weight=60
    export function onEndermite(handler: () => void): void {
        pearlErrorHandler = handler;
    }

    //% block="last Endermite error"
    //% blockNamespace="EnderNet"
    //% weight=59
    export function getLastEndermiteError(): string {
        return lastPearlError;
    }

    export function httpGet(url: string, onResponse: (body: string, status: number) => void): void {
        const target = (url.indexOf("http") === 0) ? url : httpBaseUrl + url;
        fetch(target, { method: "GET" })
            .then(function (res: any) {
                const status = res.status;
                res.text().then(function (body: string) {
                    if (onResponse) onResponse(body, status);
                });
            })
            .catch(function (err: any) {
                if (onResponse) onResponse("Error: " + err, 0);
            });
    }

    export function httpPost(url: string, body: string, onResponse: (body: string, status: number) => void): void {
        const target = (url.indexOf("http") === 0) ? url : httpBaseUrl + url;
        fetch(target, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: body
        })
            .then(function (res: any) {
                const status = res.status;
                res.text().then(function (text: string) {
                    if (onResponse) onResponse(text, status);
                });
            })
            .catch(function (err: any) {
                if (onResponse) onResponse("Error: " + err, 0);
            });
    }

    export function wsConnect(url: string, id: string, worldId: string): void {
        if (ws) ws.close();
        clientId = id;
        currentWorldId = worldId;
        ws = new WebSocket(url);

        ws.onopen = function () {
            if (ws.readyState === 1) {
                ws.send(JSON.stringify({
                    type: "join_world",
                    worldId: currentWorldId,
                    from: clientId
                }));
            }
        };

        ws.onmessage = function (ev: any) {
            try {
                const data = JSON.parse(ev.data);
                if (data.type === "player_join") {
                    lastJoinedPlayer = data.from;
                    if (wsJoinHandler) wsJoinHandler();
                } else if (data.type === "player_leave") {
                    lastLeftPlayer = data.from;
                    if (wsLeaveHandler) wsLeaveHandler();
                } else {
                    lastReceivedMessage = data.message;
                    lastReceivedSender = data.from;
                    if (wsMsgHandler) wsMsgHandler();
                }
            } catch (e) {
                lastReceivedMessage = ev.data;
                lastReceivedSender = "raw";
                if (wsMsgHandler) wsMsgHandler();
            }
        };
    }
}