"use strict";

import {HanafudaGameOptions,Hanafuda} from "./hanafuda.js"
import {Field,Player,CPU} from "./hanafuda.js"

//Elements from <div id="home">
const homeDiv = document.querySelector("#home");
const startButton = document.querySelector("#buttonGameStart")
const optionButton = document.querySelector("#buttonGameOption");
const optionDialog = document.querySelector("#gameOptionDialog");
const homeGraphics = document.querySelector("#homePageGraphics");

//Elements from <main id="game"> aka Elements of card display areas
let gamePage = document.querySelector("main");
let gameAreaCPU = document.querySelector("#handCPU");
let gameAreaPlayer = document.querySelector("#handPlayer");
let gameAreaField = document.querySelector("#handField");

//Home Page Events
startButton.addEventListener("click", gameInitialization);

optionButton.addEventListener("click",()=>{
    if(!document.querySelector("#gameOptionForm")){
        const generatedForm = HanafudaGameOptions.generateGameOptionFormElement();
        optionDialog.appendChild(generatedForm);
    }
    optionDialog.showModal();
})

//Game related instances
const player = new Player(gameAreaPlayer,"プレイヤー");
const cpu = new CPU(gameAreaCPU,"CPU");
const table = new Field(gameAreaField);
const hanafudaGame = new Hanafuda(window.hanafudaOptions ?? new HanafudaGameOptions(),[player,cpu],table,2);

//In Game Events Testing Ground
document.body.addEventListener("pickcard",(event)=>{
    console.warn("'pickcard'Event => Player selected : ",event.detail);
    const findMatch = new CustomEvent("findmatch",{detail:event.detail});
    gameAreaField.querySelector("#table").dispatchEvent(findMatch);
})

document.body.addEventListener("unpickcard",(event)=>{
    // console.log("Cancel please");
    document.querySelectorAll(".possibleMatch").forEach((elm)=>{
        elm.classList.remove("possibleMatch");
    })
})

document.body.addEventListener("firstactiondone",(event)=>{
    console.warn("firstactiondone");
    const drawCardFromDeck = new CustomEvent("drawcardfromdeck",{detail:event.detail});
    gameAreaField.querySelector("#deck").dispatchEvent(drawCardFromDeck);
})

document.body.addEventListener("turnend",(event)=>{
    const currentTurnPlayer = event.detail;
    console.warn("This guy's turn ended: ", currentTurnPlayer);
    console.warn(hanafudaGame.checkRemainingTurns()," turns left!!");
    hanafudaGame.recordPlayerDoneTurn(currentTurnPlayer);
    hanafudaGame.checkPlayerHandForYaku(currentTurnPlayer);
})

document.body.addEventListener("nextplayerturn",(event)=>{
    console.warn("Proceed to check if is next player!");
    console.log("Upcoming player is:",event.detail); //should be a single player
    console.log("'nextplayerturn' event: Game Instance",hanafudaGame);
    const upcomingPlayer = event.detail;
    hanafudaGame.newTurn();
    hanafudaGame.proceedtoNextPlayer(upcomingPlayer);
})

document.body.addEventListener("koikoi",(event)=>{
    console.warn("Player KoiKoi-ing",event.detail);
    const playerWithYaku = event.detail;
    hanafudaGame.koiKoi(playerWithYaku);
})

document.body.addEventListener("nextround",(event)=>{
    console.warn("Proceed to next round!");
    console.warn("Before Next Round Detail",event.detail);
    //will have access to all players + a special flag
    //until I decide to incorporate a flag to indicate game end via not koikoi-ing, event.detail only have array contaning all players ins is never used
    //now still the same... just that this event fired from koikoi dialog will have 2 additional keys as shown
    //all players can still be accessed via detail.allPlayerIns, not that I need it
    const koiKoiEvt = event.detail?.closeKoiKoiEvt ?? null;
    const notkoiKoiPlayer = event.detail?.winningPlayer ?? null;
    hanafudaGame.tallyRoundResult(koiKoiEvt,notkoiKoiPlayer);
})

//Only fired from static #Yaku.notification()!
//If no more rounds, summariseGame will fire an gameend event
document.body.addEventListener("startnewround",(event)=>{
    hanafudaGame.newRound(); //now newRound() does all the resetting... no need .resetStatusForNextRound() on each player ins
    //event.detail contains game instance, which is not really necessary to use, aka same as hanafudaGame
    if (hanafudaGame.checkRemainingRounds() <= 0){
        hanafudaGame.summariseGame();
    }
    else{
        hanafudaGameNewRound();
    }
})

document.body.addEventListener("gameend",(event)=>{
    console.log("End of Game", event.detail);
    if (!document.body.hasAttribute("inert")) document.body.toggleAttribute("inert");
    endHanafudaGame();
})

//End of testing area

function gameInitialization(event){
    let clickTime;
    const bodyClassList = document.body.classList;
    
    event.target.parentNode.toggleAttribute("inert"); //disable further interaction with menu

    requestAnimationFrame(function darker(timestamp){
        let animationRequest;
        clickTime ??= timestamp;
        let elapsed = timestamp - clickTime;
        if (!bodyClassList.contains("shiftBlack")) bodyClassList.add("shiftBlack");
        let currentBrightness = window.getComputedStyle(document.body).getPropertyValue("filter").match(/(?<=\()\d\.*\d*/);
        if (elapsed < 1500){
            if(currentBrightness>0) animationRequest = requestAnimationFrame(darker);
        }
        if (currentBrightness < 0.1) {
            homeDiv.remove();
            bodyClassList.remove("shiftBlack");
            cancelAnimationFrame(animationRequest);
        };
    });

    setTimeout(()=>{
        hanafudaGameNewRound();
    },1600);
}

function hanafudaGameNewRound(){
    const oyaPlayer = hanafudaGame.determineOyaKen();
    const masterDeck = hanafudaGame.newDeck(gameAreaField);
    if (window.hanafudaOptions) hanafudaGame.currentGameOptions = window.hanafudaOptions;
    else if (!window.hanafudaOptions) window.hanafudaOptions = hanafudaGame.currentGameOptions;
    //If player opened the option dialog, the window will always have a copy.
    //If never, when initiating instance, will automaticaly fill it with new(), so in that case, hanafuda ins will always have a copy
    //So here we sync it if player ever open the dialog (There's the only place to create it on window!)
    //The code never read from currentGameOptions anyway...
    //Maybe i should try to sync using Object.is(), priortising window. ver as code read from it.. although there's ternary operator safety net anyway
    let initialDrawRecipientOrder = player.oyaOrKo === "Oya" ? [player,table,cpu] : [cpu,table,player];
    do{
        initialDrawRecipientOrder.forEach((entity)=>{
            let drawnCards = masterDeck.draw(2);
            entity.receive(drawnCards,false); //only render when have all cards
        })
    }while(masterDeck.remainingCardCount > 24);

    //player.artificialInjectCard(hanafudaGame.newDeck().draw(30));
    console.log(hanafudaGame);

    masterDeck.renderDeck();
    player.renderArea();
    cpu.renderArea();
    table.renderArea();

    hanafudaGame.proceedtoNextPlayer(oyaPlayer);
}

function endHanafudaGame(){
    //I plan to have diff animation... but that's low priority;
    let startTime;
    const bodyClassList = document.body.classList;

    requestAnimationFrame(function darker(timestamp){
        let animationRequest;
        startTime ??= timestamp;
        let elapsed = timestamp - startTime;
        if (!bodyClassList.contains("shiftBlack")) bodyClassList.add("shiftBlack");
        let currentBrightness = window.getComputedStyle(document.body).getPropertyValue("filter").match(/(?<=\()\d\.*\d*/);
        if (elapsed < 1500){
            if(currentBrightness>0) animationRequest = requestAnimationFrame(darker);
        }
        if (currentBrightness < 0.1) {
            location.reload();
        };
    })
    
}