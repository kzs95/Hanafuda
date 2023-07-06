"use strict";

import {HanafudaGameOptions,Hanafuda} from "./hanafuda.js"
import {Field,Player,CPU} from "./hanafuda.js"

//Elements from <div id="home">
const homeDiv = document.querySelector("#home");
const startButton = document.querySelector("#buttonGameStart")
const optionButton = document.querySelector("#buttonGameOption");
const optionDialog = document.querySelector("#gameOptionDialog");

//Elements from <main id="game"> aka Elements of card display areas
let gamePage = document.querySelector("main");
let gameAreaCPU = document.querySelector("#handCPU");
let gameAreaPlayer = document.querySelector("#handPlayer");
let gameAreaField = document.querySelector("#handField");
let gameAreaDeck = document.querySelector("#deck");
let gameAreaTable = document.querySelector("#table");

//Game related instances
const player = new Player(gameAreaPlayer);
const cpu = new CPU(gameAreaCPU);
const table = new Field(gameAreaField);
const hanafudaGame = new Hanafuda(window.hanafudaOptions, [player,cpu],table);

//Home Page Events
startButton.addEventListener("click", gameInitialise)

optionButton.addEventListener("click",()=>{
    if(!document.querySelector("#gameOptionForm")){
        const generatedForm = HanafudaGameOptions.generateGameOptionFormElement();
        optionDialog.appendChild(generatedForm);
    }
    optionDialog.showModal();
})


//Custom Events
const eventGameStart = new CustomEvent("gamestart");
const eventTurnEnd = new CustomEvent("turnend");
const eventYaku = new CustomEvent("yaku");

//Events Testing Ground
document.body.addEventListener("pickcard",(event)=>{
    // console.log("Player selected : ",event.detail);
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
    const drawCardFromDeck = new CustomEvent("drawcardfromdeck",{detail:event.detail});
    gameAreaDeck.dispatchEvent(drawCardFromDeck);
})

document.body.addEventListener("turnend",(event)=>{
    const currentTurnPlayer = event.detail;
    console.log("This guy's turn ended:");
    console.log(currentTurnPlayer);
    hanafudaGame.checkPlayerHandForYaku(currentTurnPlayer);
})

//End of testing area

function gameInitialise(event){
    let clickTime;
    const bodyClassList = document.body.classList;
    
    event.target.parentNode.setAttribute("inert","");

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
    })

    window.hanafudaOptions ??= new HanafudaGameOptions();
    hanafudaGame.determineOyaKen();
    const masterDeck = hanafudaGame.newDeck(gameAreaDeck);
    let initialDrawRecipientOrder = player.oyaOrKo === "Oya" ? [player,table,cpu] : [cpu,table,player];
    do{
        initialDrawRecipientOrder.forEach((entity)=>{
            let drawnCards = masterDeck.draw(2);
            entity.receive(drawnCards,false);
        })
    }while(masterDeck.remainingCardCount > 24);

    player.artificialInjectCard();

    console.log(player);
    console.log(cpu);
    console.log(table);
    masterDeck.renderDeck();
    player.renderArea();
    cpu.renderArea();
    table.renderArea();
}