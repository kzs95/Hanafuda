"use strict";

export {CardDeck,Card,Hikari,Tane,Tanzaku,Kasu};
export {CardGame,HanafudaGameOptions,Hanafuda};
export {CardHoldingEntity,Field,Player,CPU};

class CardDeck{
    #deck;
    #areaInDOM;
    constructor(everyCards,areaInDOM){
        this.#deck = everyCards; //everyCards needs to an array containing instance of Cards/its descendants
        this.#areaInDOM = areaInDOM;
    }

    get remainingCardCount(){
        return this.#deck.length;
    }

    accessElement(){
        return this.#areaInDOM;
    }

    shuffle(){
        for (let i = 0; i < this.#deck.length; i++){
            let randomCard = Math.floor(Math.random() * (this.#deck.length));
            [this.#deck[i],this.#deck[randomCard]] = [this.#deck[randomCard],this.#deck[i]];
        }
    }
    draw(qty=1){
        //remove specified amount of item from array
        //remove quantity can never larger than remaining item (length)
        qty = Math.min(qty, this.#deck.length);
        let drawnCard = this.#deck.splice(0,qty);
        return drawnCard;
        //ALWAYS return an array, even just one
    }
    renderDeck(){ //this will never work with >2 players
        const deckIns = this;
        const area = this.accessElement();
        
        const previousDeckContent = area.querySelector("#deck");
        if (previousDeckContent) previousDeckContent.remove();

        const deckDiv = document.createElement("div");
        deckDiv.setAttribute("id","deck");
        deckDiv.setAttribute("lang","jp");
        deckDiv.setAttribute("class","hanafudaCards");

        function drawCardHandler(event){
            const currentPlayer = event.detail; //contain instance of Player
            const [drawnCard] = deckIns.draw(1); 

            console.log("Drawn From Deck",drawnCard);

            const drawncardDiv = drawnCard.renderCard({faceUp:true,listenerType:"none"});
            drawncardDiv.classList.add("picked","drawnFromDeck");
            deckDiv.appendChild(drawncardDiv);
            currentPlayer.receive([drawnCard],false); //receive requires card instance in array
            
            const pickCard = new CustomEvent("pickcard",{detail:drawnCard});
            document.body.dispatchEvent(pickCard);
        }

        deckDiv.addEventListener("drawcardfromdeck",drawCardHandler);
        area.insertAdjacentElement("afterbegin",deckDiv);
    }
}

class Card{
    #id;
    #cardName;
    #width;
    #height;
    #owner;
    #associatedElement;
    constructor(id,cardName,width,height){
        this.#id = id;
        this.#cardName = cardName;
        this.#width = width;
        this.#height = height;
        this.#associatedElement = undefined;
        this.#owner = "Deck";
    }

    get cardId(){
        return this.#id;
    }

    get cardIdMonthNo(){
        return this.cardId.slice(0,2); //this returns a string! "01", if need number, need pass it to Number.parseInt()
    }

    get cardFullName(){
        return this.#cardName;
    }

    get dimensionRatio(){
        return this.#width / this.#height;
    }

    get associatedElement(){
        return this.#associatedElement;
    }

    linktoDOM(element){
        this.#associatedElement = element;
    }

    updateOwner(entity){
        //entity should be instance of player or field
        this.#owner = entity;
    }

    getOwner(){
        return this.#owner;
    }

    #getResourcePath(){
        //CRITICAL PROBLEM, IF NO GETTER SETTER,THIS FAILS!!! 
        //Currently preserve getter
        //UNSURE. [P.Issue] Currently need to grab the HanafudaGameOptions instance stored globally
        let path = `url(./assets/cards/${window?.hanafudaOptions?.cardColor === "alternate" ? "alternate" : "traditional"}/${this.cardId}.svg)`;
        return path;
    }

    renderCard({faceUp = true , listenerType = "none"}){
        let cardDiv = document.createElement("div");
        cardDiv.setAttribute("id",this.cardId);
        cardDiv.setAttribute("class","hanafudaCards");
        if (faceUp){
            cardDiv.style.setProperty("background-image",this.#getResourcePath())
        }
        this.linktoDOM(cardDiv);

        const pickCard = new CustomEvent("pickcard",{detail:this});
        const unpickCard = new CustomEvent("unpickcard");
        const captureCard = new CustomEvent("capturecard",{detail:this});
        //const firstActionDone = new CustomEvent("firstactiondone",{detail:this.getOwner()});
        //this one don't have issue with owner as first action card always have an owner assigned, rather than just "Deck"

        let currentlySelectedCard;
        const clickPlayerCardHandler = function clickHand(event){
            const existingSelectedCard = document.querySelector(".picked");
            if(currentlySelectedCard !== event.target){
                event.target.classList.toggle("picked");
                currentlySelectedCard = event.target;
            }
            else if(currentlySelectedCard === event.target){
                currentlySelectedCard = undefined;
                document.body.dispatchEvent(unpickCard);
                //tells <body> (event process hub) a card has been clicked on
                //main reason not send to the table div is that I don't wish this file make any reference to items in index.html, in case that fil changes
                //All the references to index.html shall be done at main.js
            }
            if (existingSelectedCard){
                existingSelectedCard.classList.remove("picked");
            }
        }

        const clickTableCardHandler = function clickTable(event){
            let isMatch = event.target.classList.contains("possibleMatch");
            let hasPicked = document.querySelector(".picked");
            if (hasPicked && isMatch){
                document.querySelectorAll(".possibleMatch").forEach((elm)=>{
                    elm.classList.remove("possibleMatch");
                });
                hasPicked.classList.remove("picked");
                console.log("dispatching capture to", hasPicked)
                hasPicked.dispatchEvent(captureCard);
            }
        }

        let listenerToUse;
        switch(listenerType){
            case "playerCard":
                listenerToUse = clickPlayerCardHandler;
                break;
            case "tableCard":
                listenerToUse = clickTableCardHandler;
                break;
            default:
                break;
        }

        if (listenerType !== "none") cardDiv.addEventListener("click",listenerToUse);

        const cardIns = this;

        function captureCardHandler(event){
            const fieldCardToCapture = event.detail; //contain instance if Card (located at Field)
            const pickedCard = cardIns;
            const pickedCardOwner = pickedCard.getOwner();
            pickedCardOwner?.giveAwayCard(pickedCard);
            fieldCardToCapture.getOwner()?.giveAwayCard(fieldCardToCapture);
            pickedCardOwner.capture(pickedCard,fieldCardToCapture);

            const actionComplete = new CustomEvent("actioncompleted",{detail:pickedCardOwner});
            pickedCard.associatedElement.dispatchEvent(actionComplete);
        }

        function dealToFieldHandler(event){
            const fieldInstance = event.detail; //contain instance of Field
            const pickedCard = cardIns;
            const pickedCardOwner = pickedCard.getOwner();
            const dealtCard = pickedCardOwner?.giveAwayCard(pickedCard);
            fieldInstance.receive(dealtCard);

            console.log(pickedCardOwner,"dealt the following Card:",pickedCard)

            const actionComplete = new CustomEvent("actioncompleted",{detail:pickedCardOwner});
            pickedCard.associatedElement.dispatchEvent(actionComplete);
        }

        function actionCompleteHandler(event){ //need rework if need to accomodate >2 players
            const pickedCardOwner = event.detail;
            const triggeredByDeckDraw = document.querySelector(".drawnFromDeck");
            if (triggeredByDeckDraw){setTimeout(()=>triggeredByDeckDraw.remove(),1000)}
            // Currently no animation, I wish for the card to stay longer there to give a visualisation of card drawn from deck. Don't want the card to disappear too fast

            const turnEnd = new CustomEvent("turnend",{detail:pickedCardOwner});
            const firstActionDone = new CustomEvent("firstactiondone",{detail:pickedCardOwner});
            
            pickedCardOwner.turnActionSuccess();
            const pickedCardOwnerTurnActionCount = pickedCardOwner.turnActionPerformed;

            console.log("Turn ",pickedCardOwnerTurnActionCount," of ",pickedCardOwner," ended")

            if (pickedCardOwnerTurnActionCount === 1) document.body.dispatchEvent(firstActionDone);
            else if (pickedCardOwnerTurnActionCount >= 2) document.body.dispatchEvent(turnEnd);
        }

        function nullifyInteraction(){
            cardDiv.removeEventListener("click",listenerToUse);
        }

        function activateInteraction(){
            cardDiv.addEventListener("click",listenerToUse);
        }

        cardDiv.addEventListener("capturecard",captureCardHandler);
        cardDiv.addEventListener("dealtofield",dealToFieldHandler);
        cardDiv.addEventListener("actioncompleted",actionCompleteHandler);
        cardDiv.addEventListener("nullify",nullifyInteraction);
        cardDiv.addEventListener("activate",activateInteraction);

        //6 July.. Fail to migrate it to an event as the owner changed halfway... if inside the method, the pickedcardowner will be locked to the initial owner, which won't cause issue
        //6 July.. Success. Since the owner changed hands, create the event inside capture/dealtable handler, to lock the detail to the correct player instance 
        //I guess If event created outside, it will be locked to initial "Deck", which will not ba a problem for initially distributed cards

        const mutateObserveOpt = {subtree:false,childList:false,attributeFilter:["class"],attributeOldValue:true};
        const mutateObserveCallback = function(mutateRecordArr,observer){
            mutateRecordArr.forEach((mutation)=>{
                if (mutation.target.classList.contains("picked")){
                    console.warn("Mutation Observer Caallback")
                    document.body.dispatchEvent(pickCard);
                }
            });
        }
        const observer = new MutationObserver(mutateObserveCallback);
        if (this.getOwner() instanceof Player && !(this.getOwner() instanceof CPU)) observer.observe(cardDiv,mutateObserveOpt);

        //Testing Area End

        return cardDiv;
    }
}

//HanafudaCard class replace the rest??? 4 classes seems unnecessary
//Then need to change Card to receive width height only...
class HanafudaCard extends Card{
    constructor(categ,id,cardName){
        super(3.2,5.4);
        this.categ = categ;
        this.id = id;
        this.cardName = cardName;
    }

    get cardValue(){
        let value;
        switch(this.categ){
            case "hikari":
                value = 20;
                break;
            case "tane":
                value = 10;
                break;
            case "tanzaku":
                value = 5;
                break;
            case "kasu":
                value = 1;
                break;               
        }
        return value;
    }
}

//Wikipedia: They are typically smaller than Western playing cards, only 2+1⁄8 by 1+1⁄4 inches (5.4 by 3.2 cm),but thicker and stiffer.
class Hikari extends Card{
    constructor(id,cardName){
        super(id,cardName,3.2,5.4);
    }
    get cardCategory(){
        return "hikari";
    }
    get cardValue() {return 20};
}
class Tane extends Card{
    constructor(id,cardName){
        super(id,cardName,3.2,5.4);
    }
    get cardCategory(){
        return "tane";
    }
    get cardValue() {return 10};
}
class Tanzaku extends Card{
    constructor(id,cardName){
        super(id,cardName,3.2,5.4);
    }
    get cardCategory(){
        return "tanzaku";
    }
    get cardValue() {return 5};
}
class Kasu extends Card{
    constructor(id,cardName){
        super(id,cardName,3.2,5.4);
    }
    get cardCategory(){
        return "kasu";
    }
    get cardValue() {return 1};
}

//UNSURE -- Not sure if is a good idea, for now, at least at the time of creation, is stored in window object (global variable)
//Probably store it in Hanafuda instance after game start
class HanafudaGameOptions{
    #cardColor;
    #gameMode;
    #hanami;
    #tsukimi;
    #teshi;
    #kuttsuki;
    constructor(){
        this.#cardColor = "alternate";
        this.#gameMode = "12-Rounds";
        this.#hanami = false;
        this.#tsukimi = false;
        this.#teshi = false;
        this.#kuttsuki = false;  
    }

    get cardColor(){
        return this.#cardColor;
    }

    get gameMode(){
        return this.#gameMode;
    }

    get hanami(){
        return this.#hanami;
    }

    get tsukimi(){
        return this.#tsukimi;
    }

    get teshi(){
        return this.#teshi;
    }

    get kuttsuki(){
        return this.#kuttsuki;
    }

    static #AllGameOptions = {
        //toggling,selecting,...(maybe more) are categories, determining the type of input needed, e.g. toggling is radio
        //each item in these categories (toggling, ..) is enclosed within a <fieldset> element
        toggling:[
            {
                controlName:"cardColor",
                legendText:"カード",
                data:[{labelText:"伝統色",id:"trad",value:"traditional",defaultSelect:false},{labelText:"色違い",id:"alt",value:"alternate",defaultSelect:true}]
            }
            /*,{
                controlName:"gameMode",
                legendText:"ゲームモード",
                data:[{labelText:"12回戦",id:"twelveRound",value:"12-Rounds",defaultSelect:true},{labelText:"50まで",id:"toFifty",value:"Till-50",defaultSelect:false}]
            }*/
        ],
        selecting:[
            {
                controlName:"additionalYaku",
                legendText:"追加役",
                data:[{labelText:"花見で一杯",id:"hanami",value:"hanamiOn",defaultSelect:false},{labelText:"月見で一杯",id:"tsukimi",value:"tsukimiOn",defaultSelect:false}]
            }
            /*,{
                controlName:"tefuda",
                legendText:"手札の役",
                data:[{labelText:"手四",id:"teshi",value:"teshiOn",defaultSelect:false},{labelText:"くっつき",id:"kuttsuki",value:"kuttsukiOn",defaultSelect:false}]
            }*/
        ]
    }

    static generateGameOptionFormElement(){
        //This methid returns a <form> element. If ever need to change the form, no longer need to edit HTML and here
        //I will preserve the dialog element creation code here....
        const allOptions = this.#AllGameOptions;

        const form = document.createElement("form");
        form.setAttribute("id","gameOptionForm");
        form.setAttribute("name","gameOptionForm");
        form.setAttribute("method","dialog");
        // let dialog = document.createElement("dialog");
        // dialog.setAttribute("id","gameOptionDialog");
        // dialog.setAttribute("lang","jp");
        // dialog.appendChild(form);

        for (const [optionCateg,optionCategEntries] of Object.entries(allOptions)){
            let typeOfInput = "hidden"; //If there's additional type not covered by the switch statement below, at least it won't display
            switch(optionCateg){
                case "toggling":
                    typeOfInput = "radio";
                    break;
                case "selecting":
                    typeOfInput = "checkbox";
                    break;
            }

            for (const {controlName,legendText,data} of optionCategEntries){
                let fieldset = document.createElement("fieldset");
                let legend = document.createElement("legend");
                legend.textContent = legendText;
                fieldset.insertAdjacentElement("afterbegin",legend);
                for(const {labelText,id,value,defaultSelect} of data){
                    let inputAttrName = typeOfInput === "radio" ? controlName : id;//[P.Issue] Barring type="radio". All <input>'s "id" and "name" should be the same.
                    let label = document.createElement("label");
                    let input = document.createElement("input");
                    label.setAttribute("for",id);
                    label.textContent = labelText;
                    input.setAttribute("type",typeOfInput);
                    input.setAttribute("id",id);
                    input.setAttribute("name",inputAttrName);
                    input.setAttribute("value",value);
                    if (defaultSelect && (typeOfInput === "radio" || typeOfInput === "checkbox")) input.setAttribute("checked","");
                    fieldset.append(label,input);
                }
                form.insertAdjacentElement("beforeend",fieldset)
            }
        }

        //the reset and submit button
        let resetBtn = new Image();
        resetBtn.src="assets/icon/undo_40.svg";
        resetBtn.setAttribute("alt","Reset");
        resetBtn.setAttribute("class","buttonLike");
        resetBtn.setAttribute("id","gameOptionResetButton");

        let submitBtn = document.createElement("input");
        submitBtn.setAttribute("alt","Confirm");
        submitBtn.setAttribute("src","assets/icon/done_40.svg");
        submitBtn.setAttribute("type","image");

        form.insertAdjacentElement("beforeend",resetBtn);
        form.insertAdjacentElement("beforeend",submitBtn);

        form.addEventListener("submit",(event)=>{
            let formElm = event.target;
            formElm.reportValidity();
            //currently make use FormData object
            //let allFormControls = formElm.elements;
            const formData = new FormData(formElm);
            const gameOptions = new HanafudaGameOptions();
            gameOptions.updateOptions(formData);
            window.hanafudaOptions = gameOptions;
            console.log("Options updated !");
        });

        resetBtn.addEventListener("click",(event)=>{
            let formParent = event.currentTarget.closest("form");
            formParent.reset();
        })

        return form;
    }

    updateOptions(formDataIterable){
        //formDataIterable is an instance of FormData.
        this.#cardColor = formDataIterable.get("cardColor") ?? "traditional";
        this.#gameMode = formDataIterable.get("gameMode") ?? "12-Rounds";
        //if a checkbox not checked, get() will return null, Boolean() will make it false naturally.. but retain '?? false' for now
        this.#hanami = Boolean(formDataIterable.get("hanami")) ?? false; 
        this.#tsukimi = Boolean(formDataIterable.get("tsukimi")) ?? false;
        this.#teshi = Boolean(formDataIterable.get("teshi")) ?? false;
        this.#kuttsuki = Boolean(formDataIterable.get("kuttsuki")) ?? false; 

        //Old Implementation w/all sorts of public setter... which I really want to get rid of..
        //There's no dynamic access to private fields... via bracket notation 
        //In this code, pasing the iterable obtained from a submit event via new FormData(event.target).entries() should.. work
        //as both seems have no diff when use with for...of
        // for (const [optionsKey,optionsValue] of formDataIterable){
        //     this[optionsKey] = optionsValue;
        // }
    }
}

class CardGame{
    #playerList;
    #playingTable;
    #totalRounds;
    #currentTurnPlayer;
    #doneTurnPlayer;
    #maxTurnsPerRound;
    constructor(playerList,playArea,totalRounds){
        //playerList shall be an array containing at least 2 instances of Player
        //totalRounds is just an integer stating the max round of games, if omitted, default to whatever the subclass passes
        this.#playerList = playerList;
        this.#playingTable = playArea;
        this.#totalRounds = totalRounds;
        this.#currentTurnPlayer = undefined;
        this.#doneTurnPlayer = [];
        this.#maxTurnsPerRound = playerList.length * 8;
    }

    allPlayers(){
        return this.#playerList;
    }

    newTurn(){
        this.#maxTurnsPerRound -= 1;
        this.#doneTurnPlayer = [];
        this.allPlayers().forEach((player)=>{
            player.resetStatusForNextTurn();
        });
    }

    newRound(){
        this.#totalRounds -= 1;
        this.#doneTurnPlayer = [];
        this.#maxTurnsPerRound = this.#playerList.length  * 8;
        this.allPlayers().forEach((player)=>{
            player.resetStatusForNextRound();
        });
        this.#playingTable.clearHand();
    }

    summariseGame(){
        const allPlayers = this.#playerList;
        let otherPlayersWithSameHighestPoint = 0;
        const mostPointsPlayer = allPlayers.reduce((mostPt,player)=>{
            const finalPoints = player.getCurrentPoints();
            if (finalPoints > mostPt.point) {
                mostPt.winner = player;
                mostPt.point = finalPoints;
                otherPlayersWithSameHighestPoint = 0;
            }
            else if (finalPoints === mostPt.point) {
                otherPlayersWithSameHighestPoint++;
            }
            return {...mostPt};
        },{winner:null,point:0,__proto__:null});

        const gameResult = otherPlayersWithSameHighestPoint > 0 ? {winner:"Draw",point:NaN,__proto__:null} : mostPointsPlayer;

        // if (otherPlayersWithSameHighestPoint > 0)return "Draw"; //( || !mostPointsPlayer.winner)
        // else return mostPointsPlayer;

        const dialog = document.createElement("dialog");
        const resultText = document.createElement("p");
        const separationLine = document.createElement("hr");
        const endBtn = document.createElement("button");
        
        resultText.textContent = otherPlayersWithSameHighestPoint > 0 ? "引き分け" : `${mostPointsPlayer.winner.playerName} 勝ちます！`;
        endBtn.textContent = "おしまい";
        endBtn.setAttribute("class","endButton")
        dialog.setAttribute("id","gameSummaryDialog");
        dialog.setAttribute("lang","jp");
        dialog.insertAdjacentElement("afterbegin",resultText);
        
        allPlayers.forEach((player)=>{
            const resultPlaque = document.createElement("div");
            const nameDisplay = document.createElement("p");
            const pointDisplay = document.createElement("p");
            nameDisplay.textContent = player.playerName;
            pointDisplay.textContent = `合計点  ${player.getCurrentPoints().toLocaleString("ja-JP-u-nu-hanidec")}`;
            resultPlaque.setAttribute("class","finalPoint");
            if (otherPlayersWithSameHighestPoint === 0 && player === mostPointsPlayer.winner){
                resultPlaque.classList.add("winner");
            }
            resultPlaque.append(nameDisplay,pointDisplay);
            dialog.append(resultPlaque);
        });

        dialog.append(separationLine,endBtn);

        const closeDialog = function(event){
            dialog.close();
        }

        const closeResult = function(event){
            dialog.remove();
            const gameEnd = new CustomEvent("gameend",{detail:gameResult});
            document.body.dispatchEvent(gameEnd);
        }

        endBtn.addEventListener("click",closeDialog);
        dialog.addEventListener("close",closeResult);
        document.body.insertAdjacentElement("beforeend",dialog);
        dialog.showModal();
    }

    getActivePlayer(){
        return this.#currentTurnPlayer;
    }

    getInactivePlayers(){
       return this.allPlayers().filter((player)=> player !== this.#currentTurnPlayer);
    }

    recordPlayerDoneTurn(player){
        this.#doneTurnPlayer.push(player);
    }

    checkRemainingTurns(){
        return this.#maxTurnsPerRound;
    }
    
    checkRemainingRounds(){
        return this.#totalRounds;
    }

    //[CPU Trial]
    proceedtoNextPlayer(upcomingPlayer){
        this.#currentTurnPlayer = upcomingPlayer; //replaced old setNextPlayer()
        const inactivePlayers = this.getInactivePlayers();
        
        console.log("This guy turn",upcomingPlayer);
        console.log("Inactive this turn",this.getInactivePlayers());

        if (document.body.hasAttribute("inert")) document.body.toggleAttribute("inert");

        const nextRound = new CustomEvent("nextround",{detail:{allPlayerIns:this.allPlayers()}});
        const nullify = new CustomEvent("nullify",{detail:inactivePlayers});
        const activate = new CustomEvent("activate",{detail:upcomingPlayer});
        const cpuAction = new CustomEvent("cpuaction",{detail:upcomingPlayer}); //[CPU Trial]

        if (this.checkRemainingTurns() <= 0){
            console.log("No More Turn. Next Round.")
            document.body.dispatchEvent(nextRound);
        }

        else{
            const activePlayerDOM = upcomingPlayer.accessElement();
            const activePlayerCard = upcomingPlayer.displayHand();
            activePlayerDOM.style.filter="";
            activePlayerCard.forEach((card)=>{
                card.associatedElement.dispatchEvent(activate);
            })

            inactivePlayers.forEach((idle)=>{
                const inactivePlayerDOM = idle.accessElement();
                const idlePlayerCards = idle.displayHand();
                inactivePlayerDOM.style.filter="grayscale(50%)";
                idlePlayerCards.forEach((card)=>{
                    card.associatedElement.dispatchEvent(nullify);
                });
            })
            
            if (upcomingPlayer instanceof CPU){ //[CPU Trial]
                console.warn("CPU's turn. Automated action.")
                upcomingPlayer.accessElement().firstElementChild.dispatchEvent(cpuAction); //the first element child is the cpu's hand
            }
        }
    }
}

class Hanafuda extends CardGame{
    #gameOptions;
    constructor(gameOptions,playerList,playArea,totalRounds=12){
       super (playerList,playArea,totalRounds);
       this.#gameOptions = gameOptions;
       //gameOptions needs to be an instance of HanafudaGameOptions
    }
    // advised to always access private static fields through the class name, not through 'this', so inheritance doesn't break the method
    static #AllCards = {
        fuda:[
            {month:"January",name:"matsu",categories:{hikari:1,tane:0,tanzaku:1,kasu:2}},
            {month:"February",name:"ume",categories:{hikari:0,tane:1,tanzaku:1,kasu:2}},
            {month:"March",name:"sakura",categories:{hikari:1,tane:0,tanzaku:1,kasu:2}},
            {month:"April",name:"fuji",categories:{hikari:0,tane:1,tanzaku:1,kasu:2}},
            {month:"May",name:"kakitsubata",categories:{hikari:0,tane:1,tanzaku:1,kasu:2}},
            {month:"June",name:"botan",categories:{hikari:0,tane:1,tanzaku:1,kasu:2}},
            {month:"July",name:"hagi",categories:{hikari:0,tane:1,tanzaku:1,kasu:2}},
            {month:"August",name:"susuki",categories:{hikari:1,tane:1,tanzaku:0,kasu:2}},
            {month:"September",name:"kiku",categories:{hikari:0,tane:1,tanzaku:1,kasu:2}},
            {month:"October",name:"momiji",categories:{hikari:0,tane:1,tanzaku:1,kasu:2}},
            {month:"November",name:"yanagi",categories:{hikari:1,tane:1,tanzaku:1,kasu:1}},
            {month:"December",name:"kiri",categories:{hikari:1,tane:0,tanzaku:0,kasu:3}}
        ],
        [Symbol.iterator]: function*() {
            for (const[monthNo,{month,name,categories}] of this.fuda.entries()){
                for (const [category,count] of Object.entries(categories)){
                    for (let i=1;i<=count;i++){
                        let idString = `${(monthNo+1).toString().padStart(2,"0")}_${name}_${category}`; // e.g. 01_matsu_kasu
                        if (count > 1) {idString += `_${String.fromCharCode(i + 64).toLowerCase()}`}; //kasu has multiple card, generate _a,_b, or _c at end
                        let particle = category === "kasu" ? "の" : "に";
                        let cardName = `${Hanafuda.#Hana[month].hana}${particle}${Hanafuda.#Hana[month].egara[category]}`;
                        let createdCard;
                        switch (category){
                            case "hikari":
                                createdCard = new Hikari(idString,cardName);
                                break;
                            case "tane":
                                createdCard = new Tane(idString,cardName);
                                break;
                            case "tanzaku":
                                createdCard = new Tanzaku(idString,cardName);
                                break;
                            case "kasu":
                                createdCard = new Kasu(idString,cardName);
                                break;
                        }
                        yield Object.freeze(createdCard);
                        //previous implementation yield an Object object {id,categ,cardName}
                    }
                }
            } 
        }
    }

    //"（" charCode: 62588 HTML: &#62588 UTF16: 0xFF08
    //"）" charCode: 62589 HTML: &#62589 UTF16: 0xFF09

    static #Hana = {
        January:{
            hana:"松（まつ）",
            egara:{hikari:"鶴（つる）",tane:null,tanzaku:"赤短",kasu:"カス"}
        },
        February:{
            hana:"梅（うめ）",
            egara:{hikari:null,tane:"鴬（うぐいす）",tanzaku:"赤短",kasu:"カス"}
        },
        March:{
            hana:"桜（さくら）",
            egara:{hikari:"幕（まく）",tane:null,tanzaku:"赤短",kasu:"カス"}
        },
        April:{
            hana:"藤（ふじ）",
            egara:{hikari:null,tane:"不如帰（ほととぎす）",tanzaku:"短冊",kasu:"カス"}
        },
        May:{
            hana:"杜若（かきつばた）",
            egara:{hikari:null,tane:"八橋（やつはし）",tanzaku:"短冊",kasu:"カス"}
        },
        June:{
            hana:"牡丹（ぼたん）",
            egara:{hikari:null,tane:"蝶（ちょう）",tanzaku:"青短",kasu:"カス"}
        },
        July:{
            hana:"萩（はぎ）",
            egara:{hikari:null,tane:"猪（いのしし）",tanzaku:"短冊",kasu:"カス"}
        },
        August:{
            hana:"芒（すすき）",
            egara:{hikari:"月（つき）",tane:"雁（かり）",tanzaku:null,kasu:"カス"}
        },
        September:{
            hana:"菊（きく）",
            egara:{hikari:null,tane:"盃（さかずき）",tanzaku:"青短",kasu:"カス"}
        },
        October:{
            hana:"紅葉（もみじ）",
            egara:{hikari:null,tane:"鹿（しか）",tanzaku:"青短",kasu:"カス"}
        },
        November:{
            hana:"柳（やなぎ）",
            egara:{hikari:"小野道風（おの の みちかぜ）",tane:"燕（つばめ）",tanzaku:"短冊",kasu:"カス"}
        },
        December:{
            hana:"桐（きり）",
            egara:{hikari:"鳳凰（ほうおう）",tane:null,tanzaku:null,kasu:"カス"}
        }
    }
    
    //note: access private, use class name , 'this' also can here, but issue when subclass call it?

    get currentGameOptions(){
        return this.#gameOptions;
    }
    
    set currentGameOptions(gameOptionsInstance){
        this.#gameOptions = gameOptionsInstance;
    }
    newDeck(areaInDOM){
    	let allCards = [...Hanafuda.#AllCards];
        let deck  = new CardDeck(allCards,areaInDOM);
        //Might add a do not shuffle option.
        deck.shuffle();
        return deck;
    }

    determineOyaKen(){
        const players = super.allPlayers(); //players are instance of Player
        let cards = this.newDeck();
        let havePastWinner = false;
        let orderInfo = Object.create(null, {
            earliest:{value:undefined,writable:true},
            largest:{value:undefined,writable:true}
        });
        //let orderInfo = {earliest:false,largest:"Not Checked"}; //legacy

        players.sort((playerA,playerB)=>{
            const winStatusA = playerA.wonPreviousRound;
            const winStatusB = playerB.wonPreviousRound;
            if (winStatusA || winStatusB) havePastWinner = true;

            if (winStatusA) return -1;
            else if (winStatusB) return 1;
            else return 0;
        })

        if (!havePastWinner){
            do{
                orderInfo.earliest = false;
                orderInfo.largest = "Not checked.";

                players.forEach((player)=>{
                    const [drawn] = cards.draw();
                    player.getsu = drawn;
                })

                //the array containing the players will be sorted according to the getsu card they hold

                players.sort((playerA,playerB)=>{
                    const monthA = Number.parseInt(playerA.getsu?.cardId?.slice(0,2));
                    const monthB = Number.parseInt(playerB.getsu?.cardId?.slice(0,2));
                    if (monthA !== monthB) orderInfo.earliest = true;
                    //legacy - from when object literal default earliest: true
                    // if (monthA === monthB) orderInfo.earliest = false; 
                    // else orderInfo.earliest = true;
                    return monthA - monthB;
                })

                if (!orderInfo.earliest){
                    players.sort((playerA,playerB)=>{
                        const cardValueA = playerA.getsu?.cardValue;
                        const cardValueB = playerB.getsu?.cardValue;
                        if (cardValueA === cardValueB) orderInfo.largest = false;
                        else orderInfo.largest = true;
                        return cardValueB - cardValueA;
                    })
                }
            }while((!orderInfo.earliest && !orderInfo.largest) && cards.remainingCardCount >= players.length);

            // [8 July Update]
            // Shorter... Improved(?) method. Sort both criteria in one go. Written with >2 players in mind.. Works but .largest might occassionally display werid(?) if >2 players
            // do{
            //     orderInfo.earliest = false;
            //     orderInfo.largest = false;

            //     players.forEach((player)=>{
            //         const [drawn] = cards.draw();
            //         player.getsu = drawn;
            //     })

            //     players.sort((playerA,playerB)=>{
            //         const monthA = Number.parseInt(playerA.getsu?.cardIdMonthNo);
            //         const monthB = Number.parseInt(playerB.getsu?.cardIdMonthNo);
            //         const cardValueA = playerA.getsu?.cardValue;
            //         const cardValueB = playerB.getsu?.cardValue;
            //         if (monthA !== monthB) orderInfo.earliest = true;
            //         if (cardValueA !== cardValueB) orderInfo.largest = true;

            //         if (orderInfo.earliest) return monthA - monthB;
            //         else return cardValueB - cardValueA;
            //     })
            // }while((!orderInfo.earliest && !orderInfo.largest) && cards.remainingCardCount >= players.length);
        }

        players.forEach((player,index)=>{
            if (index === 0) {
                player.isOya();
            }
            else player.isKo();
        })

        return players[0]; //return the player at first index -> oya always at first

        // return players; 
        //this will return an array of player/cpu instances, sorted in the order of descending getsu
        //OR an array with player winning last round at first

        //[NOTE] this method, despite written to be usable with >2 players,... 
        //have no way to determine order based on winlose/cardDrawn beyond the Oya, which will be pushed to the first of returning array
        //If needed, it should be implemented at CardGame side (maybe have a array store fixed clockwise order, then splice the order array)... 
        //as the most important goal here is to determine Oya and set the rest to Ko... the return value is suppossedly never needed.
    }

    static getFlowerByMonth(month){
        //If is special "all" string, convert it to 99
        //Any number passed as string will be attempted to be converted into number
        if (typeof month === "string" && month?.toLowerCase() === "all") month = 99;
        month = Number.parseInt(month);
        let allFlowers = Object.entries(Hanafuda.#Hana).map(([,{hana}])=>hana);

        if (Number.isNaN(month)){
            return undefined;
        }
        else if (month === 99){
            return allFlowers.join("、");
        }
        else{
            //make month 1-based index, makes more sense
            //if <=0, return Jan, if > 12 (Dec), return Dec
            month -=1;
            if (month < 0) month = 0;
            month = Math.min(month,11);
            return allFlowers[month];
        }   
    }

    static #getIdByCategMonth(cardCateg, ...month){
        //cardCateg takes a string of hikari, tane, tanzaku, or kasu
        //month - can pass multiple 1-based-index integer of month
        let idArray = [];
        for (const card of [...Hanafuda.#AllCards]){
            //card is instances of Hikari,Tane... (instances of Card)
            let id = card.cardId;
            let idMonthPart = card.cardIdMonthNo; 
            let categ = card.cardCategory;
            if (categ === cardCateg && month.includes(Number.parseInt(idMonthPart))) idArray.push(id);
        }
        return idArray;
    }
    //Pre Instance based (new Hikari, Kasu @Generator) version. Prev cards are basic Object objects
    // static #getIdByCategMonth(cardCateg,...month){
    //     //cardCateg takes a string of hikari, tane, tanzaku, or kasu
    //     //month - can pass multiple 1-based-index integer of month
    //     let idArray = [];
    //     for (const {id,categ} of [...Hanafuda.#AllCards]){
    //         //the generated id always start with month no. at first 2 character follow by underscore, unless changes made there at [Symbol.Iterator]
    //         let idMonthPart = id.slice(0,2); //id.match(/\d{2}/)[0];
    //         if (categ === cardCateg && month.includes(Number.parseInt(idMonthPart))) idArray.push(id);
    //         //if (categ === cardCateg && month === Number.parseInt(idMonthPart)) idArray.push(id); //old
    //     }
    //     return idArray;
    // }

    static #checkGoKou(capturedHikari){
        let metCriteria = 0;
        const combination = Hanafuda.#getIdByCategMonth("hikari",1,3,8,11,12);
        for (const card of capturedHikari){
            if (combination.includes(card.cardId)) metCriteria++;
        }
        return {gokou: metCriteria === 5 ? true : false};
    }

    static #checkShiKou(capturedHikari){
        let metCriteria = 0;
        const combination = Hanafuda.#getIdByCategMonth("hikari",1,3,8,12);
        for (const card of capturedHikari){
            if (combination.includes(card.cardId)) metCriteria++;
        }
        return {shikou: metCriteria === 4 ? true : false};
    }

    static #checkAmeShiKou(capturedHikari){
        let metCriteria = 0;
        let michiKaze = false; //小野道風（おの の みちかぜ）
        const [michiKazeCard] = Hanafuda.#getIdByCategMonth("hikari",11);
        const combination = Hanafuda.#getIdByCategMonth("hikari",1,3,8,12);
        for (const card of capturedHikari){
            if (card.cardId === michiKazeCard) michiKaze = true;
            else if (combination.includes(card.cardId)) metCriteria++;
        }
        return {ameshikou: michiKaze === true && metCriteria >= 3 ? true : false};
    }

    static #checkSanKou(capturedHikari){
        let metCriteria = 0;
        const combination = Hanafuda.#getIdByCategMonth("hikari",1,3,8,12);
        for (const card of capturedHikari){
            if (combination.includes(card.cardId)) metCriteria++;
            if (metCriteria === 3) break;
        }
        return {sankou: metCriteria === 3 ? true : false};
    }

    static #checkInoShikaChou(capturedTane){
        let metCriteria = 0;
        const combination = Hanafuda.#getIdByCategMonth("tane",6,7,10);
        for (const card of capturedTane){
            if (combination.includes(card.cardId)) metCriteria++;
        }
        return {inoshikachou: metCriteria === 3 ? true : false};
    }

    static #checkAkaTan(capturedTanzaku){
        let metCriteria = 0;
        const combination = Hanafuda.#getIdByCategMonth("tanzaku",1,2,3);
        for (const card of capturedTanzaku){
            if (combination.includes(card.cardId)) metCriteria++;
        }
        return {akatan: metCriteria === 3 ? true : false};
    }

    static #checkAoTan(capturedTanzaku){
        let metCriteria = 0;
        const combination = Hanafuda.#getIdByCategMonth("tanzaku",6,9,10);
        for (const card of capturedTanzaku){
            if (combination.includes(card.cardId)) metCriteria++;
        }
        return {aotan: metCriteria === 3 ? true : false};
    }

    static #checkTanePoint(capturedTane){
        let metCriteria = 0
        for (const card of capturedTane){
            if (card instanceof Tane) metCriteria++;
        }
        return {tane: Math.max(0, metCriteria - 4)}; //5 == 1 pt, if 5 get 1 pt, if 4 or below no pt;
    }

    static #checkTanPoint(capturedTanzaku){
        let metCriteria = 0
        for (const card of capturedTanzaku){
            if (card instanceof Tanzaku) metCriteria++;
        }
        return {tan: Math.max(0, metCriteria - 4)};
    }

    static #checkKasuPoint(capturedKasu){
        let metCriteria = 0
        for (const card of capturedKasu){
            if (card instanceof Kasu) metCriteria++;
        }
        return {kasu: Math.max(0, metCriteria - 9)};
    }

    static #checkTsukimiDeIppai(capturedHikari,capturedTane){
        let tsuki = false; //芒に月（つき）
        let kiku = false; //菊に盃（さかずき）
        const [tsukiCard] = Hanafuda.#getIdByCategMonth("hikari",8);
        const [kikuCard] = Hanafuda.#getIdByCategMonth("tane",9);

        for (const card of capturedHikari){
            if (card.cardId === tsukiCard) tsuki = true;
        }
        //if don't have tsuki, don't bother check kiku
        if (tsuki){
            for (const card of capturedTane){
                if (card.cardId === kikuCard) kiku = true;
            }
        }
        return {tsukimideippai: tsuki && kiku ? true : false};
    }

    static #checkHanamiDeIppai(capturedHikari,capturedTane){
        let sakuraMaku = false; //桜に幕（まく）
        let kiku = false; //菊に盃（さかずき）
        const [sakuraMakuCard] = Hanafuda.#getIdByCategMonth("hikari",3);
        const [kikuCard] = Hanafuda.#getIdByCategMonth("tane",9);

        for (const card of capturedHikari){
            if (card.cardId === sakuraMakuCard) sakuraMaku = true;
        }
        //if don't have sakura, don't bother check kiku
        if (sakuraMaku){
            for (const card of capturedTane){
                if (card.cardId === kikuCard) kiku = true;
            }
        }
        return {hanamideippai: sakuraMaku && kiku ? true : false};
    }
    
    checkPlayerHandForYaku(player){ //aka a player's turn ended
        console.log("Checking player's captured cards...");
        let yakuList = player.displayYaku();
        player.archiveYaku(); //make a copy of previous result

        const capturedHikari = player.displayCaptured("hikari");
        const capturedTane = player.displayCaptured("tane");
        const capturedTanzaku = player.displayCaptured("tanzaku");
        const capturedKasu = player.displayCaptured("kasu");
        const hanamiOn = window?.hanafudaOptions?.hanami ?? false;
        const tsukimiOn = window?.hanafudaOptions?.tsukimi ?? false;
        const kuttsukiOn = window?.hanafudaOptions?.kuttsuki ?? false;
        const teshiOn = window?.hanafudaOptions?.teshi ?? false;

        let highestHikariYakuFound = false;
        const hikariCheckOrder = [Hanafuda.#checkGoKou,Hanafuda.#checkShiKou,Hanafuda.#checkAmeShiKou,Hanafuda.#checkSanKou];

        //Previously the check functions return boolean/int only, have to resort to checkFunction.name.match(/(?<=\#check)\w+/i) to build an object with said func's name...zzz
        const highestHikariGrade = hikariCheckOrder.reduce((highestRecorded,checkFunction)=>{
            const result = checkFunction(capturedHikari);
            const resultValue = Object.values(result)[0];//the return object only have one key (e.g.{someyaku:true/false/integer}), here should only be Boolean
            if (resultValue && !highestHikariYakuFound){
                highestHikariYakuFound = true;
                highestRecorded = result;
            }
            return {...highestRecorded};
        },{})

        const inoshikachou = Hanafuda.#checkInoShikaChou(capturedTane);
        const akatan = Hanafuda.#checkAkaTan(capturedTanzaku);
        const aotan = Hanafuda.#checkAoTan(capturedTanzaku);
        const tane = Hanafuda.#checkTanePoint(capturedTane);
        const tan = Hanafuda.#checkTanPoint(capturedTanzaku);
        const kasu = Hanafuda.#checkKasuPoint(capturedKasu);
        const hanami = hanamiOn? Hanafuda.#checkHanamiDeIppai(capturedHikari,capturedTane) : false;
        const tsukimi = tsukimiOn? Hanafuda.#checkTsukimiDeIppai(capturedHikari,capturedTane) : false;

        Object.assign(yakuList,highestHikariGrade,inoshikachou,akatan,aotan,hanami,tsukimi,tane,tan,kasu,);
        const newYaku = player.checkYakuHistory(); //newYaku is something like ["gokou","inoshikachou"]
        console.log("New", newYaku)
        //if turn left is 0 don't koikoi !!! && super.checkRemainingTurns check
        console.warn("Currently turn ",super.checkRemainingTurns())
        if (newYaku.length > 0 && super.checkRemainingTurns() > 1){ //[UNSURE] If 2, if opponent left 1 card, no more koikoi
            Hanafuda.#Yaku.notification(player,"koikoi");
        }
        else { //no yaku found, proceed to next player, if no more player awaiting their turn, next round
            if (super.checkRemainingTurns() <= 0){
                const nextRound = new CustomEvent("nextround",{detail:{allPlayerIns:super.allPlayers()}});
                document.body.dispatchEvent(nextRound);
            }
            else{
                const nextPlayer = super.getInactivePlayers()[0];
                //get the next in array among the inactive players, this will be very problematic in >2 players
                //probably filter out playerList by making use of this.#doneTurnPlayer;
                const nextPlayerTurn = new CustomEvent("nextplayerturn",{detail:nextPlayer});
                document.body.dispatchEvent(nextPlayerTurn)
            }
        }
    }

    static #Yaku = {
        gokou:{displayName:"五光",point:10},
        shikou:{displayName:"四光",point:8},
        ameshikou:{displayName:"雨四光",point:7},
        sankou:{displayName:"三光",point:5},
        inoshikachou:{displayName:"猪鹿蝶",point:5},
        akatan:{displayName:"赤短",point:5},
        aotan:{displayName:"青短",point:5},
        hanamideippai:{displayName:"花見で一杯",point:5},
        tsukimideippai:{displayName:"月見で一杯",point:5},
        tane:{displayName:"タネ",point:1},
        tan:{displayName:"タン",point:1},
        kasu:{displayName:"カス",point:1},
        kuttsuki:{displayName:"くっつき",point:6},
        teshi:{displayName:"手四",point:6},
        oyaken:{displayName:"親権",point:6},

        notification(playerToNotify, followUp, pointsEarned){
            //playerToNotify is instance of Player
            //followUp = "tallyround" is for final turn, fire an event triggering next round. "koikoi" fire an event to trigger koikoi prompt
            const playerYakuList = playerToNotify.displayYaku();
            const dialog = document.createElement("dialog");
            
            const separationLine = document.createElement("hr");
            const yesBtn = document.createElement("button");
            dialog.setAttribute("class","newYakuNotification");
            dialog.setAttribute("lang","jp");

            Object.entries(playerYakuList).forEach(([yaku,yakuValue])=>{
                if (yakuValue){
                    const displayText = document.createElement("p");
                    displayText.textContent = this[yaku].displayName;
                    //Pretty redundant stuff
                    const multiplierText = typeof yakuValue === "number" ? ` ${yakuValue.toLocaleString("ja-JP-u-nu-hanidec")}` : "";
                    if (multiplierText){
                        const numSpan = document.createElement("span");
                        numSpan.style.color = "red";
                        numSpan.textContent = multiplierText;
                        displayText.insertAdjacentElement("beforeend",numSpan);
                    }
                    //
                    dialog.append(displayText);
                }
            });

            if (followUp === "koikoi"){
                const title = document.createElement("p");
                title.innerText = `${playerToNotify.playerName}\r\n出来役`;
                title.style.cssText = "color:#173d75;margin-block-start:0;"
                dialog.insertAdjacentElement("afterbegin",title);
            }

            if (followUp === "tallyround"){
                const winnerText = document.createElement("div");
                const pointDisplay = document.createElement("span");
                const playerName = document.createElement("span");
                winnerText.setAttribute("class","roundResultText");
                winnerText.innerText = ` 勝ちます。\r\n得点 `;
                playerName.textContent = playerToNotify.playerName;
                playerName.setAttribute("class","highlights");
                pointDisplay.textContent = pointsEarned;
                pointDisplay.setAttribute("class","highlights");
                pointDisplay.style.cssText = "writing-mode:horizontal-tb";

                winnerText.insertAdjacentElement("afterbegin",playerName);
                winnerText.insertAdjacentElement("beforeend",pointDisplay);

                dialog.setAttribute("id","roundSummaryYaku");
                dialog.append(winnerText);
            }

            yesBtn.textContent = followUp === "tallyround" ? "次へ" : "はい";
            yesBtn.setAttribute("class","yesButton");
            dialog.append(separationLine,yesBtn);

            const closeDialog = function(event){
                dialog.close();
            }
            const closeNotification = function(event){
                dialog.remove();
                const koiKoi = new CustomEvent("koikoi",{detail:playerToNotify});
                const startNewRound = new CustomEvent("startnewround",{detail:this});
                if (followUp === "tallyround") document.body.dispatchEvent(startNewRound);
                else if (followUp === "koikoi") document.body.dispatchEvent(koiKoi);
            }

            yesBtn.addEventListener("click",closeDialog);
            dialog.addEventListener("close",closeNotification);
            document.body.insertAdjacentElement("beforeend",dialog);
            dialog.showModal();
        }
    }

    #calculateYaku(playerYakuList){
        const totalPt =  Object.entries(playerYakuList).reduce((total,[yaku,yakuValue])=>{
            let yakuPt;
            const basePoint = Hanafuda.#Yaku[yaku].point; //this === static #Yaku{}
            if (yakuValue){ yakuPt = typeof yakuValue === "number" ? yakuValue * basePoint : basePoint;}
            return total + (yakuPt ?? 0);
        },0)

        return totalPt;
    }

    tallyRoundResult(koiKoiEvent=null,notKoiKoiPlayer=null){ 
        //This is a way to safeguard(?) the passing of a non-winning player?
        //This is an exposed method, can use in in Main.js... but you shouldn't pass any shit there as is meant for draw matches
        //I initially separate login for winning via koikoi dialog... but better merge them..... [10 July]
        console.warn("Tally round result...");
        const allPlayers = super.allPlayers();
        let roundHighestPoint = {player:null,point:0,__proto__:null};
        let otherPlayersWithSameHighestPoint = 0; //meaning additional player with first recorded highest point

        if (koiKoiEvent?.type==="owari" && notKoiKoiPlayer){
            roundHighestPoint.player = notKoiKoiPlayer;
            roundHighestPoint.point = this.#calculateYaku(notKoiKoiPlayer.displayYaku());
        } //triggered by choosing not to koikoi when prompted

        else if (koiKoiEvent === null && notKoiKoiPlayer === null){
            roundHighestPoint = allPlayers.reduce((hiPoint,player)=>{
                const playerYakuList = player.displayYaku();
                const playerPoint = this.#calculateYaku(playerYakuList);
                if (playerPoint > hiPoint.point) {
                    hiPoint.player = player;
                    hiPoint.point = playerPoint;
                    otherPlayersWithSameHighestPoint = 0;
                }
                else if(playerPoint === hiPoint.point) {
                    otherPlayersWithSameHighestPoint++;
                }
                return {...hiPoint};
            },roundHighestPoint);
        }//means a normal round tally with when num of turns per round ran out

        console.log("roundHighestPoint is : ", roundHighestPoint);
        console.log("otherPlayersWithSameHighestPoint ",otherPlayersWithSameHighestPoint)

        if (otherPlayersWithSameHighestPoint > 0 || !roundHighestPoint.player){ 
            //no one got any points (aka yaku) or more than 1 player have same point
            const [oyaPlayer] = allPlayers.filter((player)=> player.oyaOrKo() === "Oya");
            Object.assign(oyaPlayer.displayYaku(),{oyaken:true}); //we inject this special oyaken yaku into it 
            roundHighestPoint.player = oyaPlayer;
            roundHighestPoint.point = Hanafuda.#Yaku.oyaken.point;
        }

        const winningPlayer = roundHighestPoint.player;
        const totalPoints = roundHighestPoint.point;
        const losingPlayers = allPlayers.filter((player)=>player !== winningPlayer);

        winningPlayer.recordRoundResult("w",totalPoints);
        console.warn(winningPlayer.playerName," won this round with point: ",totalPoints);
        losingPlayers.forEach((lostPlayer)=>{
            console.warn(lostPlayer.playerName, " lost this round.");
            lostPlayer.recordRoundResult("l",0);
        });

        Hanafuda.#Yaku.notification(winningPlayer,"tallyround",totalPoints);
    }

    koiKoi(playerWithYaku){
        const inactivePlayers = super.getInactivePlayers();
        const nextPlayer = inactivePlayers[0]; //problem with >2 players .Probably make use of this.#doneTurnPlayer + filter allPlayers()
        const nextPlayerTurn = new CustomEvent("nextplayerturn",{detail:nextPlayer});
        const owari = new CustomEvent("owari",{detail:{player:playerWithYaku,reason:"Choose not to continue."}});
        //never listened, a workaround to replace close dialog event used in previous build
        const nextRound = new CustomEvent("nextround",{detail:{allPlayerIns:super.allPlayers(),winningPlayer:super.getActivePlayer(),closeKoiKoiEvt:owari}});
        
        const koiKoiDialog = document.querySelector("#koiKoiDialog");
        if (playerWithYaku instanceof CPU){ //[CPU Trial]
            const cpuContinue = playerWithYaku.cpuKoiKoiDecision(this); //return a random Boolean
            const cpuDecision = cpuContinue ? nextPlayerTurn : nextRound;
            setTimeout(()=>{
                document.body.dispatchEvent(cpuDecision);
            },1000);
        }

        else {
            if (koiKoiDialog){
                koiKoiDialog.showModal();
            }

            else if (!koiKoiDialog){
                const dialog = document.createElement("dialog");
                const form = document.createElement("form");
                const fieldset = document.createElement("fieldset");
                const promptText = document.createElement("p");
                const separationLine = document.createElement("hr");
                const yesBtn = document.createElement("button");
                const noBtn = document.createElement("button");
        
                dialog.setAttribute("id","koiKoiDialog");
                dialog.setAttribute("lang","jp");
                form.setAttribute("method","dialog");
                form.setAttribute("name","koiKoiDialog");
                promptText.textContent="こいこいしますか？";
                yesBtn.setAttribute("type","submit");
                yesBtn.setAttribute("value","yes");
                yesBtn.setAttribute("class","yesButton");
                yesBtn.textContent = "はい";
                noBtn.setAttribute("type","submit");
                noBtn.setAttribute("value","no");
                noBtn.setAttribute("class","noButton");
                noBtn.textContent = "いいえ";
        
                fieldset.insertAdjacentElement("afterbegin",promptText);
                fieldset.insertAdjacentElement("beforeend",separationLine);
                fieldset.insertAdjacentElement("beforeend",yesBtn);
                fieldset.insertAdjacentElement("beforeend",noBtn);
                form.insertAdjacentElement("beforeend",fieldset);
                dialog.insertAdjacentElement("beforeend",form);
        
                dialog.addEventListener("close",(event)=>{
                    if (!dialog.returnValue || dialog.returnValue === "yes"){
                        console.log("KoiKoi selected. Proceed to next player!");
                        document.body.dispatchEvent(nextPlayerTurn);
                    }
                    else if (dialog.returnValue === "no"){
                        console.log("Not KoiKoi. Player Wins. Go next round!");
                        document.body.dispatchEvent(nextRound);
                    }
                });
                
                document.body.insertAdjacentElement("beforeend",dialog);
                dialog.showModal();
            }
        }
    }
}

class CardHoldingEntity{
    #holding;
    #areaInDOM;
    constructor(areaInDOM){
        this.#holding = [];
        this.#areaInDOM = areaInDOM;
    }

    //use when attempting to add a card into Player/CPU/Field's hand
    receive(cards,rerender=true){
        //the card is an array -> CardGame's .draw(qty) method return an array, hence spread it
        cards.forEach((card)=>card.updateOwner(this));
        this.#holding.push(...cards);
        if (rerender !== false) this.renderArea();
    }
    //use when removing a card from Player/CPU/Field's hand (aka .#holding), happens when capturing (send to captured) or dealing to Field
    //usu. followed by capture()/receive(), which states where the card will go
    //should call deal(), but field aka table don't deal the card right!?
    giveAwayCard(card){
        const hand = this.displayHand();
        const cardPositionInHand = hand.indexOf(card);
        let dealtCard = hand.splice(cardPositionInHand,1);
        this.renderArea();
        return dealtCard;
    }
    clearHand(){
        this.#holding = [];
    }
    displayHand(){
        return this.#holding;
    }
    accessElement(){
        return this.#areaInDOM;
    }
}

class Field extends CardHoldingEntity{
    constructor(areaInDOM){
        super(areaInDOM);
    }

    renderArea(){
        const fieldIns = this;
        const area = super.accessElement();
        const handCards = super.displayHand();

        const previousTableContent = area.querySelector("#table");
        if (previousTableContent) previousTableContent.remove();

        const tableDiv = document.createElement("div")
        tableDiv.setAttribute("id","table");
        handCards.forEach((handCard)=>{
            const cardDiv = handCard.renderCard({faceUp:true,listenerType:"tableCard"});
            tableDiv.appendChild(cardDiv);
        })

        //Event Testing Use
        function findMatchHandler(event){
            console.log("findMatch",performance.now(),event.detail);
            let matchingCardCount = 0;
            const cardPickedByPlayer = event.detail; //a card instance
            const pickedCardMonth = cardPickedByPlayer?.cardIdMonthNo;
            const ownerOfPickedCard = cardPickedByPlayer.getOwner(); //[CPU Trial]

            //const allMatches = document.querySelectorAll(".possibleMatch"); //now migrated down
            // allMatches.forEach((element)=>{
            //     console.log("deleting"); //this never prints, meaning this block is just garbage
            //     element.classList.remove("possibleMatch");
            // }); //TBH, I don't recall why I need this.....

            handCards.forEach((handCard)=>{
                if (pickedCardMonth === handCard.cardIdMonthNo) {
                    handCard.associatedElement.classList.add("possibleMatch");
                    matchingCardCount++;
                }
            });
            
            const allMatches = document.querySelectorAll(".possibleMatch");
            
            //[CPU Trial] If there's match found, simulate a click on the first possible match;
            if (matchingCardCount > 0 && ownerOfPickedCard instanceof CPU){
                console.warn("CPU Player trying to find a match.");
                ownerOfPickedCard.cpuPickFieldCard(allMatches);
            }

            if (matchingCardCount <= 0){
                console.log("No matchable card found.");
                const dealCardToField = new CustomEvent("dealtofield",{detail:fieldIns});
                cardPickedByPlayer.associatedElement.dispatchEvent(dealCardToField);
            }
        }
        //Previously encountered an issue where the eventlistener is attached on an element that don't get rerendered (aka "area"), and the handler gets attached multiple times
        //Even though the function is named..... unless you move it out of this function and store in let's say a static private method as its return method
        //Now the tableDiv gets rerendered all the time, so gets destroyed and re-attached again

        tableDiv.addEventListener("findmatch",findMatchHandler);
        //End of testing area

        area.insertAdjacentElement("beforeend",tableDiv)
    }
}

class Player extends CardHoldingEntity{
    #name
    #oya;
    #getsu;
    #points;
    #captured;
    #yaku;
    #yakuHistory;
    #turnActionPerformed;
    #wonPreviousRound;
    constructor(areaInDOM,name="Player",initialPoints=0){
        super(areaInDOM);
        this.#name = name;
        this.#points = initialPoints;
        this.#getsu = null;
        this.#oya = false;
        this.#captured = {hikari:[],tane:[],tanzaku:[],kasu:[]};
        this.#yaku = {
            gokou:false,
            shikou:false,
            ameshikou:false,
            sankou:false,
            inoshikachou:false,
            akatan:false,
            aotan:false,
            hanamideippai:false,
            tsukimideippai:false,
            tane:0,
            tan:0,
            kasu:0,
            kuttsuki:false,
            teshi:false,
            oyaken:false
        };
        //all these yakus' name should be same as the Hanafuda class's #check methods!! Else will be in huge ass trouble.
        this.#yakuHistory = null;
        this.#turnActionPerformed = 0;
        this.#wonPreviousRound = false; 
    }

    get playerName(){
        return this.#name;
    }

    get getsu(){
        return this.#getsu;
    }

    set getsu(cardInstance){
        this.#getsu = cardInstance;
    }

    get turnActionPerformed(){
        return this.#turnActionPerformed;
    }

    get wonPreviousRound(){
        return this.#wonPreviousRound;
    }

    getCurrentPoints(){
        return this.#points;
    }

    resetStatusForNextTurn(){
        this.#turnActionPerformed = 0;
    }

    resetStatusForNextRound(){
        super.clearHand();
        this.#turnActionPerformed = 0;
        this.#captured = {hikari:[],tane:[],tanzaku:[],kasu:[]};
        this.#yaku = {
            gokou:false,
            shikou:false,
            ameshikou:false,
            sankou:false,
            inoshikachou:false,
            akatan:false,
            aotan:false,
            hanamideippai:false,
            tsukimideippai:false,
            tane:0,
            tan:0,
            kasu:0,
            kuttsuki:false,
            teshi:false,
            oyaken:false
        };
        this.#yakuHistory = null;
    }
    
    isOya(){
        this.#oya = true;
    }

    isKo(){
        this.#oya = false;
    }

    oyaOrKo(){
        return this.#oya ? "Oya" : "Ko";
    }

    turnActionSuccess(actionPerformedCount = 1){
        this.#turnActionPerformed += actionPerformedCount;
    }

    recordRoundResult(winLose,score){
        //winLose should be a single letter string 'w' or 'l'
        //UNSURE score will be -ve/+ve or always +ve YET
        //depending on code later down the line, may need switch again
        this.#points += winLose.toLowerCase() === "l" ? 0 : score; //is lose ("l"), ennsure no points added
        this.#wonPreviousRound = winLose.toLowerCase() === "w" ? true : false;
    }

    capture(...cards){
        //should pass 2 Card instance, here don't actually has a limit, but in reality only 2 will ever be passed, at least that's what I planned
        cards.forEach((card)=>{
            card.updateOwner(this);
            if (card instanceof Hikari) this.#captured?.hikari.push(card);
            else if (card instanceof Tane) this.#captured?.tane.push(card);
            else if (card instanceof Tanzaku) this.#captured?.tanzaku.push(card);
            else if (card instanceof Kasu) this.#captured?.kasu.push(card);
        })
        this.renderArea();
    }

    displayCaptured(cardCateg){
        //cardCateg takes a string of either hikari, tane, tanzaku, or kasu
        return cardCateg === undefined ? this.#captured : this.#captured[cardCateg];
    }

    displayYaku(){
        return this.#yaku;
    }

    archiveYaku(){
        this.#yakuHistory = structuredClone(this.#yaku);
    }

    checkYakuHistory(){
        const newYakuFormed = []; 
        const currentYaku = this.#yaku;
        const previousYaku = this.#yakuHistory;

        for (const [yakuName,yakuValue] of Object.entries(currentYaku)){
            let isSame = Object.is(yakuValue,previousYaku[yakuName]);
            if (!isSame) newYakuFormed.push(yakuName);
        }

        return newYakuFormed;
    }

    renderArea(){
        const area = super.accessElement();
        const handCards = super.displayHand();
        const capturedCards = Object.entries(this.displayCaptured());

        const previousContent = Array.from(area.children);
        previousContent.forEach((element)=>{
            element.remove();
        })

        const handDiv = document.createElement("div");
        handDiv.setAttribute("class","hand");
        handCards.forEach((handCard)=>{
            const option = this instanceof CPU ? {faceUp:false,listenerType:"none"} : {faceUp:true,listenerType:"playerCard"};
            const cardDiv = handCard.renderCard(option);
            handDiv.appendChild(cardDiv);
        })
        area.insertAdjacentElement("afterbegin",handDiv);

        capturedCards.forEach(([categ,capturedArray])=>{
            const capturedDiv = document.createElement("div")
            capturedDiv.classList.add("captured",categ);
            capturedArray.forEach((capturedCard)=>{
                const cardDiv = capturedCard.renderCard({faceUp:true,listenerType:"none"});
                capturedDiv.appendChild(cardDiv);
            })
            area.insertAdjacentElement("beforeend",capturedDiv);
        })

        area.dataset.playername = this.playerName;
        area.dataset.points = this.#points.toLocaleString("ja-JP-u-nu-hanidec");

        //[CPU Trial]
        function cpuTakeAction(event){
            console.log("receive 'cpuaction' event")
            document.body.toggleAttribute("inert");
            const cpuPlayer = event.detail;
            if (cpuPlayer.turnActionPerformed === 0){
            setTimeout(()=>{
                cpuPlayer.cpuPickHandCard();
            },1000)}
        }

        //[CPU Trial]
        if(this instanceof CPU){
            handDiv.addEventListener("cpuaction",cpuTakeAction);
        }
    }

    //testing use
    artificialInjectCard(yaku){
        let c1 = new Hikari("01_matsu_hikari","w");
        let c2 = new Hikari("11_yanagi_hikari","w");
        let c3 = new Hikari("12_kiri_hikari","w");
        let c4 = new Hikari("03_sakura_hikari","w");
        let c5 = new Hikari("08_susuki_hikari","w");
        let c6 = new Tane("09_kiku_tane","w");
        let c7 = new Tane("07_hagi_tane","w");
        let c8 = new Tane("10_momiji_tane","w");
        let c9 = new Tane("06_botan_tane","w");

        if (yaku === "gokou") this.capture(c1,c2,c3,c4,c5);
        else this.capture(...yaku)
    }
}

class CPU extends Player{ //[CPU Trial]
    cpuPickHandCard(){
        const cardsHeld = super.displayHand();
        const toDeal = cardsHeld[0]; //always deal 1st card in hand;
        toDeal.associatedElement.classList.toggle("picked");
        const pickCard = new CustomEvent("pickcard",{detail:toDeal});
        console.warn("cpu deals the following card:",toDeal);
        document.body.dispatchEvent(pickCard);
    }

    cpuPickFieldCard(possibleMatches){
        console.warn("CPU will match", possibleMatches);
        setTimeout(()=>{
            possibleMatches[0].click();
        },1000)
    }

    cpuKoiKoiDecision(gameInstance){
        console.warn("CPU making KoiKoi Decision!", gameInstance);
        const rand = Math.floor(Math.random() * 2);
        return rand === 1 ? true : false;
    }
}
