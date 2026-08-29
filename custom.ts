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

declare const JSON: any;
declare const fetch: any;
declare function setTimeout(handler: () => void, timeout: number): number;

/**
 * Custom blocks for EnderNet
 */
//% weight=100 color="#5a5cff" icon="\uf233" block="EnderNet"
namespace Endernet {
    let ws: WebSocket = null;
    let pearlSource: EventSource = null;
    let currentWorldId = "default_world";
    let httpBaseUrl = "";
    let clientId = "";

    let messageHandler: (msg: string, from: string) => void = null;
    let joinHandler: (player: string) => void = null;
    let leaveHandler: (player: string) => void = null;
    let pearlStreamHandler: (data: string) => void = null;
    let pearlErrorHandler: (err: string) => void = null;

    /**
     * Connect to secure EnderNet server
     */
    //% block="connect secure EnderNet on server %hostUrl"
    export function initSecureSession(hostUrl: string): void {
        httpBaseUrl = hostUrl;

        httpPost("/api/auth/request-code", "{}", function (body: string, status: number) {
            if (status === 200) {
                let res = JSON.parse(body);
                let code = res.code;
                let claimUrl = res.claimUrl;

                player.say("§d[EnderNet] Pairing code required!");
                player.say("§eLink your MEE identity here:");
                player.say("§b" + claimUrl);
                player.say("§7Pairing Code: §f" + code);

                let isHandshakeComplete = false;

                let pollStatus = function () {
                    if (isHandshakeComplete) return;

                    httpGet("/api/auth/status/" + code, function (statusBody: string, sStatus: number) {
                        if (sStatus === 200 && !isHandshakeComplete) {
                            let sessionData = JSON.parse(statusBody);
                            if (sessionData.status === "claimed") {
                                isHandshakeComplete = true;
                                let realTag = sessionData.verifiedGamertag;
                                let world = sessionData.worldId;

                                player.say("§a[EnderNet] Verified as §f" + realTag + " §ain world §f" + world);

                                let wsUrl = hostUrl.replace("https://", "wss://").replace("http://", "ws://");
                                wsConnect(wsUrl, realTag, world);
                                return;
                            }
                        }

                        if (!isHandshakeComplete) {
                            setTimeout(pollStatus, 3000);
                        }
                    });
                };

                setTimeout(pollStatus, 3000);
            } else {
                player.say("§c[EnderNet] Server unreachable.");
            }
        });
    }

    /**
     * Broadcast a message to the server
     */
    //% block="broadcast message %msg"
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

    /**
     * Event triggered when a message is received
     */
    //% block="on message received"
    //% draggableParameters="reporter"
    export function onMessageReceived(handler: (msg: string, fromUser: string) => void): void {
        messageHandler = handler;
    }

    /**
     * Event triggered when a player joins
     */
    //% block="on player joined"
    //% draggableParameters="reporter"
    export function onPlayerJoined(handler: (joinedPlayer: string) => void): void {
        joinHandler = handler;
    }

    /**
     * Event triggered when a player leaves
     */
    //% block="on player left"
    //% draggableParameters="reporter"
    export function onPlayerLeft(handler: (leftPlayer: string) => void): void {
        leaveHandler = handler;
    }

    /**
     * Throw a Pearl stream to a world
     */
    //% block="throw Pearl stream to world %worldId"
    export function pearlThrow(worldId: string): void {
        if (pearlSource) pearlSource.close();

        let hasSlash = httpBaseUrl.charAt(httpBaseUrl.length - 1) === "/";
        let streamUrl = hasSlash
            ? httpBaseUrl + "pearl/stream/" + worldId
            : httpBaseUrl + "/pearl/stream/" + worldId;

        pearlSource = new EventSource(streamUrl);

        pearlSource.onmessage = function (ev: any) {
            if (pearlStreamHandler) pearlStreamHandler(ev.data);
        };

        pearlSource.onerror = function (err: any) {
            if (pearlErrorHandler) pearlErrorHandler("Endermite spawned: Stream error");
        };
    }

    /**
     * Event triggered on Pearl stream hit
     */
    //% block="on Pearl stream hit"
    //% draggableParameters="reporter"
    export function onPearlHit(handler: (pearlData: string) => void): void {
        pearlStreamHandler = handler;
    }

    /**
     * Event triggered on Endermite error
     */
    //% block="on Endermite error"
    //% draggableParameters="reporter"
    export function onEndermite(handler: (errorMsg: string) => void): void {
        pearlErrorHandler = handler;
    }

    /**
     * Disconnect from EnderNet
     */
    //% block="disconnect EnderNet"
    export function disconnect(): void {
        if (ws) ws.close();
        if (pearlSource) pearlSource.close();
        ws = null;
        pearlSource = null;
    }

    function httpGet(url: string, onResponse: (body: string, status: number) => void): void {
        let target = (url.indexOf("http") === 0) ? url : httpBaseUrl + url;
        fetch(target, { method: "GET" })
            .then(function (res: any) {
                let status = res.status;
                res.text().then(function (body: string) {
                    if (onResponse) onResponse(body, status);
                });
            })
            .catch(function (err: any) {
                if (onResponse) onResponse("Error: " + err, 0);
            });
    }

    function httpPost(url: string, body: string, onResponse: (body: string, status: number) => void): void {
        let target = (url.indexOf("http") === 0) ? url : httpBaseUrl + url;
        fetch(target, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: body
        })
            .then(function (res: any) {
                let status = res.status;
                res.text().then(function (text: string) {
                    if (onResponse) onResponse(text, status);
                });
            })
            .catch(function (err: any) {
                if (onResponse) onResponse("Error: " + err, 0);
            });
    }

    function wsConnect(url: string, id: string, worldId: string): void {
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
                let data = JSON.parse(ev.data);
                if (data.type === "player_join") {
                    if (joinHandler) joinHandler(data.from);
                } else if (data.type === "player_leave") {
                    if (leaveHandler) leaveHandler(data.from);
                } else {
                    if (messageHandler) messageHandler(data.message, data.from);
                }
            } catch (e) {
                if (messageHandler) messageHandler(ev.data, "raw");
            }
        };
    }
}