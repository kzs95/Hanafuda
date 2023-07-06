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
    renderDeck(){
        const deckDiv = this.accessElement();
        deckDiv.setAttribute("lang","jp");
        deckDiv.setAttribute("class","hanafudaCards");

        deckDiv.addEventListener("drawcardfromdeck",(event)=>{
            const currentPlayer = event.detail; //contain instance of Player
            const [drawnCard] = this.draw(1); console.log("Drawn From Deck",drawnCard);

            const drawncardDiv = drawnCard.renderCard({faceUp:true,listenerType:"none"});
            drawncardDiv.classList.add("picked","drawnFromDeck");
            deckDiv.appendChild(drawncardDiv);
            currentPlayer.receive([drawnCard],false); //receive requires card instance in array
            
            const pickCard = new CustomEvent("pickcard",{detail:drawnCard});
            document.body.dispatchEvent(pickCard);
        })
    }
}

class Card{
    #id;
    #cardName;
    #width;
    #height;
    #owner;
    #associatedElm;
    constructor(id,cardName,width,height){
        this.#id = id;
        this.#cardName = cardName;
        this.#width = width;
        this.#height = height;
        this.#associatedElm = undefined;
        this.#owner = "Deck";
    }

    get cardId(){
        return this.#id;
    }

    get cardIdMonthNo(){
        return this.cardId.slice(0,2);
    }

    get cardFullName(){
        return this.#cardName;
    }

    get dimensionRatio(){
        return this.#width / this.#height;
    }

    get associatedElm(){
        return this.#associatedElm;
    }

    linktoDOM(element){
        this.#associatedElm = element;
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
        const firstActionDone = new CustomEvent("firstactiondone",{detail:this.getOwner()})

        let currentlySelectedCard;
        const clickPlayerCardHandler = function(event){
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

        const clickTableCardHandler = function(event){
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

        //Testing
        cardDiv.addEventListener("capturecard",(event)=>{
            // console.log("Picked : ",this);
            // console.log("Capture Field : ",event.detail);
            const fieldCardToCapture = event.detail; //contain instance if Card, located at Field
            const pickedCard = this;
            const pickedCardOwner = pickedCard.getOwner();
            pickedCardOwner?.giveAwayCard(this);
            fieldCardToCapture.getOwner()?.giveAwayCard(fieldCardToCapture);
            pickedCardOwner.capture(pickedCard,fieldCardToCapture);

            const triggeredByDeckDraw = document.querySelector(".drawnFromDeck");
            if (triggeredByDeckDraw){
                setTimeout(()=>triggeredByDeckDraw.remove(),1000)
            }

            //Trial
            pickedCardOwner.turnActionSuccess();
            const pickedCardOwnerTurnActionCount = pickedCardOwner.turnActionPerformed;
            if (pickedCardOwnerTurnActionCount === 1) document.body.dispatchEvent(firstActionDone);
            else if (pickedCardOwnerTurnActionCount >= 2) console.log("Previously Capture. Turn Done!")
        })

        cardDiv.addEventListener("dealtofield",(event)=>{
            const fieldInstance = event.detail; //contain instance of Field
            const pickedCard = this;
            const pickedCardOwner = pickedCard.getOwner();
            const dealtCard = pickedCardOwner?.giveAwayCard(pickedCard);
            fieldInstance.receive(dealtCard);

            const triggeredByDeckDraw = document.querySelector(".drawnFromDeck");
            //Don't want the card to disappear too fast
            if (triggeredByDeckDraw){setTimeout(()=>triggeredByDeckDraw.remove(),1000)}

            //Trial
            pickedCardOwner.turnActionSuccess();
            const pickedCardOwnerTurnActionCount = pickedCardOwner.turnActionPerformed;
            if (pickedCardOwnerTurnActionCount === 1) document.body.dispatchEvent(firstActionDone);
            else if (pickedCardOwnerTurnActionCount >= 2) console.log("Previously Deal to Field. Turn Done!")
        })

        //[UNSURE] two share quite the amount of code, might consolidate them.....

        //Testing End
        const mutateObserveOpt = {subtree:false,childList:false,attributeFilter:["class"],attributeOldValue:true};
        const mutateObserveCallback = function(mutateRecordArr,observer){
            mutateRecordArr.forEach((mutation)=>{
                if (mutation.target.classList.contains("picked")){
                    document.body.dispatchEvent(pickCard);
                }
            });
        }
        const observer = new MutationObserver(mutateObserveCallback);
        if (this.getOwner() instanceof Player) observer.observe(cardDiv,mutateObserveOpt);

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
        this.#cardColor = "traditional";
        this.#gameMode = "12-Turns";
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
                data:[{labelText:"伝統色",id:"trad",value:"traditional",defaultSelect:true},{labelText:"色違い",id:"alt",value:"alternate",defaultSelect:false}]
            }
            /*,{
                controlName:"gameMode",
                legendText:"ゲームモード",
                data:[{labelText:"12回戦",id:"twelveTurn",value:"12-Turns",defaultSelect:true},{labelText:"50まで",id:"toFifty",value:"Till-50",defaultSelect:false}]
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

        let form = document.createElement("form");
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
        this.#gameMode = formDataIterable.get("gameMode") ?? "12-Turns";
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
    #playerArea;
    #totalRounds;
    #currentTurn;
    constructor(playerList,playArea,totalRounds){
        //playerList shall be an array containing at least 2 instances of Player
        //totalRounds is just an integer stating the max round of games, if omitted, default to whatever the subclass passes
        this.#playerList = playerList;
        this.#playerArea = playArea;
        this.#totalRounds = totalRounds;
        this.#currentTurn = undefined;
    }

    allPlayers(){
        return this.#playerList;
    }

    newRound(){
        this.#totalRounds -= 1;
    }

    setNextPlayer(player){
        //player is an instance of Player/CPU
        this.#currentTurn = player;
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

    currentGameOptions(){
        return this.#gameOptions;
    }
    
    newDeck(areaInDOM){
    	let allCards = [...Hanafuda.#AllCards];
        let deck  = new CardDeck(allCards,areaInDOM);
        //Might add a do not shuffle option.
        deck.shuffle();
        return deck;
    }

    determineOyaKen(){
        const players = super.allPlayers();
        //players are instance of Player
        //let orderInfo = {earliest:false,largest:"Not Checked"}; //legacy
        let orderInfo = Object.create(null, {
            earliest:{value:undefined,writable:true},
            largest:{value:undefined,writable:true}
        })
        let cards = this.newDeck();

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

        players.forEach((player,idx)=>{
            if (idx === 0) {
                player.isOya();
                super.setNextPlayer(player);
            }
            else player.isKo();
        })
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

    //Currently no idea how player hand like .. yet, tentaively object like {hikariField:[{Hikari inst}],taneField:[Tane inst},...],...}
    checkGokou(hikariField){
        let metCriteria = 0;
        const combination = Hanafuda.#getIdByCategMonth("hikari",1,3,8,11,12);
        for (const card of hikariField){
            if (combination.includes(id)) metCriteria++;
        }
        return metCriteria === 5 ? true:false;
    }

    checkShikou(hikariField){
        let metCriteria = 0;
        const combination = Hanafuda.#getIdByCategMonth("hikari",1,3,8,12);
        for (const card of hikariField){
            if (combination.includes(id)) metCriteria++;
        }
        return metCriteria === 4 ? true:false;
    }

    checkAmeShikou(hikariField){
        let metCriteria = 0;
        let michiKaze = false; //小野道風（おの の みちかぜ）
        const [michiKazeCard] = Hanafuda.#getIdByCategMonth("hikari",11);
        const combination = Hanafuda.#getIdByCategMonth("hikari",1,3,8,12);
        for (const card of hikariField){
            if (id === michiKazeCard) michiKaze = true;
            if (combination.includes(id)) metCriteria++;
        }
        return michiKaze === true && metCriteria >= 3 ? true:false;
    }

    checkSankou(hikariField){
        let metCriteria = 0;
        const combination = Hanafuda.#getIdByCategMonth("hikari",1,3,8,12);
        for (const card of hikariField){
            if (combination.includes(id)) metCriteria++;
            if (metCriteria === 3) break;
        }
        return metCriteria === 3 ? true:false;
    }
    
    static checkPlayerHandForYaku(player){
        //reduce? [checkGokou,checkShikou,checkAmeShikou,checkSankou]
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
        tableDiv.addEventListener("findmatch",(event)=>{
            // console.log("findMatch",performance.now())
            let matchingCardCount = 0;
            const cardPickedByPlayer = event.detail; //a card instance
            const pickedCardMonth = cardPickedByPlayer?.cardIdMonthNo;
            document.querySelectorAll(".possibleMatch").forEach((elment)=>{
                elment.classList.remove("possibleMatch");
            });
            handCards.forEach((handCard)=>{
                if (pickedCardMonth === handCard.cardIdMonthNo) {
                    handCard.associatedElm.classList.add("possibleMatch");
                    matchingCardCount++;
                }
            });
            if (matchingCardCount <= 0){
                const dealCardToField = new CustomEvent("dealtofield",{detail:this});
                console.log("No Match")
                cardPickedByPlayer.associatedElm.dispatchEvent(dealCardToField);
                // const cardDealtToField = ownerOfPickedCard.giveAwayCard(cardPickedByPlayer);
                // this.receive(cardDealtToField);
            }
        })
        //End of testing area
        area.insertAdjacentElement("beforeend",tableDiv)
    }
}

class Player extends CardHoldingEntity{
    #name
    #oya;
    #getsu;
    #points;
    #wonLast;
    #captured;
    #turnActionPerformed;
    constructor(areaInDOM,name="Player",initialPoints=0){
        super(areaInDOM);
        this.#name = name;
        this.#points = initialPoints;
        this.#getsu = null;
        this.#oya = false;
        this.#wonLast = false; 
        this.#captured = {hikari:[],tane:[],tanzaku:[],kasu:[]};
        this.#turnActionPerformed = 0;
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

    recordMatchResult(winLose,score){
        //winLose should be a single letter string 'w' or 'l'
        //UNSURE score will be -ve/+ve or always +ve YET
        this.#points += score; //depending on code later down the line, may need switch again
        this.#wonLast = winLose.toLowerCase() === "w" ? true : false;
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
        area.appendChild(handDiv);

        capturedCards.forEach(([categ,capturedArray])=>{
            const capturedDiv = document.createElement("div")
            capturedDiv.classList.add("captured",categ);
            capturedArray.forEach((capturedCard)=>{
                const cardDiv = capturedCard.renderCard({faceUp:true,listenerType:"none"});
                capturedDiv.appendChild(cardDiv);
            })
            area.appendChild(capturedDiv);
        })
    }
}

class CPU extends Player{

}