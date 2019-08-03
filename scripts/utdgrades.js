/* 
 *  Coded by Sai Tanay Desaraju.
 *  08/01/19.
 *  TODO: Add the append function.
 */

const resJQ = $("#search-results"); // The element that displays the search results.
const maxResults = 30;
var database = {};                  // To store the database.
var searches = [];                  // To store the searches (used as a stack).
let selected = new Set([]);   		// To store the selected classes.

/* 
 * Explanation for the Search Function:
 *
 * As the user types the first character in the search bar, the refreshResults() function is 
 * called, and it makes a search in the whole database and stores the result and the query in the 
 * "searches" array (used as a stack). 
 *
 * When the user types another character, the refreshResults() function peeks into the "searches" 
 * stack, checks if it is a subset of the new query. If it is, it filters out the results that 
 * are still valid, displays the results, and pushes the new query and the new results into the stack.
 *
 * If the new query is not a subset of the searches.peek() value, it pops that stack until
 * it is a subset or is empty. If it is a subset, the rest of the course is same
 * as in the above case. If it is empty, it runs this search through the whole database
 * and pushes the results to the stack.
 *
 * Example: A search of "CS 1" is stored in the following way:
 *
 * 			[{search: ["C", "", "", "all"], result:[0, 1, ... indices]},
 *				{search: ["CS", "", "", "all"], result:[0, 1, ... indices]},
 *				{search: ["CS", "1", "", "all"], result:[0, 1, ... indices]}....]
 *
 * Rule: searches[i]["search"] builds on searches[i-1]["search"] and 
 *			searches[i]["results"] is always a subset of searches[i - 1]["results"] when i > 0.
 */


/**
 * Load the data json file and parse the URL for any parameters
 */

$(function(){$.getJSON("./data.json", function(load){
    database = load;
}).fail(function() {
    $("body").text("Error Occurred. Class data couldn't be loaded.");
}).done(function() {
    /* Hide the loader and show the website */
    $("#loading-spinner").fadeOut(200, ()=>$("#main-container").fadeIn(200));
    // Parse params and execute accordingly:
    if(window.location.search.length === 0) return;
    let params = new URLSearchParams(window.location.search);
    let id = params.get("id");
    if(id !== null) {
        if(id < Object.keys(database).length) {
            addClassSearchResults([id]);
            showMainChart(id);
        } else {
            console.log("Index " + id + " from url params equals or exceeds the database length. Class load failed.");
        }
    } else {
        for (let i of params.entries()) {
            switch(i[0]) {
                case 'subj':
                    $("#search-subj").val(i[1]);
                    break;
                case 'num':
                    $("#search-num").val(i[1]);
                    break;
                case 'sect':
                    $("#search-sect").val(i[1]);
                    break;
                case 'prof':
                    $("#search-prof").val(i[1]);
                    break;
                case 'term':
                    i[1] = i[1].toLowerCase();
                    let term = i[1];
                    switch (term[2]){
                        case 's':
                            term = "Spring 20" + term[0] + term[1];
                            break;
                        case 'f':
                            term = "Fall 20" + term[0] + term[1];
                            break;
                        case 'u':
                            term = "Summer 20" + term[0] + term[1];
                            break;
                        default:
                            console.log("term couldn't be parsed");
                    }
                    $("#search-term").attr("value", term).text(i[1]);
                    break;
                default:
                    console.log("Couldn't parse URL param: " + i + "=" + i[1]);
                    break;
            }
        }
        refreshResults();
    }
})});

/**
 * 1. Enable tooltips and popovers.
 *
 * 2. Add an onclick event handler for the "select-all" checkbox in the search bar.
 *    It selects all the search results and updates the "selected" box.
 *
 * 3. Show the "get the chrome extension" footer if user is using Google Chrome.
 */

$(function () {
    /* 1 */
    $('[data-toggle="tooltip"]').tooltip();
    $('[data-toggle="popover"]').popover()

    /* 2 */
    $("#search-selectAll").on("click", ()=> {
        let isChecked = $("#search-selectAll").is(':checked');
        $('.class-info-card > div > div:last-child > input').prop('checked', isChecked);
        $(".class-info-card").each(function () {
            // Skip the "card-" part in the id property.
            refreshSelectedBox(parseInt($(this).prop("id").substring(5)), !isChecked);
        });
    });

    /* 3 */
    if(/Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor))
        $("#extension_footer").css("display", "block");
})

/**
 *  Change the size of the search bar depending on the size of the screen.
 */

$(window).on("resize ready", function () {
    if($(window).width() >= 768){
        $("#search-input-group").removeClass("input-group-sm");
        $("#search-term").removeClass("btn-sm")
    }
    else {
        $("#search-input-group").addClass("input-group-sm");
        $("#search-term").addClass("btn-sm");
    }
})

/**
 * Updates the dropdown text and calls the find function when one
 * of the options in the dropdown button is clicked.
 */

$("#search-input-group > div > .dropdown-item").on("click", function(){
    $("#search-term").attr("value", $(this).text()).text($(this).attr("value"));
    refreshResults();
});

/**
 * Called on keyup in one of the search bar elements. It gets all the query values,
 * pops values off the "searches" array until the current query is empty or is a subset
 * of the query in the query-result pair at the top of the "searches" array. Then, it
 * calls the search() function and appends the returned array of indices along with the
 * query to the "searches" array if needed.
 *
 * See the comments at the top of file for a detailed explanation.
 */
function refreshResults(){
    let subjInput = document.getElementById("search-subj").value.trim().toUpperCase();
    let numInput = document.getElementById("search-num").value.trim();
    let sectInput = document.getElementById("search-sect").value.trim();
    let profInput = document.getElementById("search-prof").value.trim().toLowerCase();
    let termInput = document.getElementById("search-term").value;

    let count = ((subjInput === "") ? 0 : 1) + ((numInput === "") ? 0 : 1) + ((sectInput === "") ? 0 : 1) + ((profInput.length < 1) ? 0 : 2);
    if(count < 2){      // Just to make sure that there are not too many results
        resJQ.empty();  // Emptied so that partial results are never shown.
        return;
    }
    if(termInput === "All") termInput = "";
    // Pops the "searches" array until searches is empty or searches.peek()["query"]
    // is a subset of the current query.
    let query = [subjInput, numInput, sectInput, profInput, termInput];
    let index = searches.length - 1;
    while(index >= 0){
        let subsetOfPrev = true;
        for(let i = 0; i < 5; i++){
            let prevSearch = searches[index]["query"];
            if(!query[i].startsWith(prevSearch[i])) {
                subsetOfPrev = false;
                break;
            }
        }
        if(subsetOfPrev) break;
        searches.pop();
        index--;
    }

    // If "searches" is not empty, it checks if the previous query
    // in "searches" matches the current query. If it does, then that
    // result is directly loaded.

    // Else, the search function is called and the results are appended
    // if the results are non-empty.

    if(searches.length > 0) {
        let isEqual = true, lastSearch = searches[searches.length - 1];
        for(let i = 0; i < 5; i++)
            if(query[i] !== lastSearch["query"][i]){
                isEqual = false;
                break;
            }
        if(isEqual){
            addClassSearchResults(searches[searches.length - 1]["result"]);
            return;
        }
    }

    let res = search(subjInput, numInput, sectInput, profInput, termInput);
    if (res.length === 0) showNoResultsAlert();
    else {
        addClassSearchResults(res);
        searches.push({query: query, result: res});
    }
}

/**
 * Filters the elements in the last element in searches array
 * according to the query and returns an array of indices of
 * database elements that still match the query.
 *
 * If searches array is empty, the whole database is searched.
 */
function search(subjInput, numInput, sectInput, profInput, termInput){
    let res = [], index = searches.length - 1;

    if(index === -1){
        // Searches the whole database
        for(let i = 0; i < database.length; i++){
            if(isResult(database[i])) res.push(i);
        }
    } else {
        // Filters the indices from the previous search
        let prevRes = searches[index]["result"];
        for(let i = 0; i < prevRes.length; i++) if(isResult(database[prevRes[i]])) res.push(prevRes[i]);
    }
    return res;

    // Returns true if the class record (arg) is a valid result for the current query.
    function isResult(arg){
        if(arg["subj"].startsWith(subjInput) && arg["num"].startsWith(numInput) && arg["term"].startsWith(termInput) && arg["sect"].startsWith(sectInput)){
            if(profInput === "") return true;
            if(typeof profInput === 'string') profInput = profInput.split(" ");
            for(let x of profInput){
                let found = false;
                for(let y of arg["prof_array"]){
                    if(y.startsWith(x)){
                        found = true;
                        break;
                    }
                }
                if(!found) return false;
            }
            return true;
        }
        else return false;
    }
}

/**
 * Shows a "No results found!" alert in the search results element.
 */
function showNoResultsAlert(){
    if (resJQ.find(".alert").length !== 0) return;  // Return if alert already exists
    resJQ.fadeOut(30, function(){
        resJQ.empty();
        resJQ.append("<div class=\"alert alert-light\" role=\"alert\">No results found!</div>").fadeIn(200);
    });
}

/**
 * Adds class search results to the search results element.
 * id of each of these elements is set to the index at which that element is in the database.
 * @param {Array} resIndices    Array of indices. All data[resIndex] elements are added to the search results element.
 */
function addClassSearchResults(resIndices){
    resJQ.empty();
    let remain = maxResults;
    for(let x of resIndices) {
        if(remain <= 0){
            break;
            resJQ.append(
                // language=HTML
                "<div class=\"alert alert-light\" role=\"alert\">" +
                    "Search too broad! Only the top " + maxResults + " results are being shown." +
                "</div>"
            );
        }
        let y = database[x];
        let grades = y["grades"];

        // Data (right column)
        resJQ.append(
            // language=HTML
            "<div class=\"card class-info-card w-100 mr-3 mb-3 overflow-hidden\" id=\"card-" + x + "\" onclick='showMainChart(" + x + ")'>" +
                "<div class=\"row\">" +
                    "<div class=\"class-graph col-4 pr-0 mh-100\"></div>" +
                    "<div class=\"col-6 col-md-6\">" +
                        "<div class=\"card-body p-1\">" +
                            "<p class=\"class-id font-weight-normal text-truncate mb-0\">" + y["subj"].toUpperCase() + " " + y["num"] + " " + y["sect"].toUpperCase() + "</p>" +
                            "<p class=\"professor text-muted text-truncate mb-0\">" +  y["prof"] + "</p>" +
                            "<p class=\"semester text-muted text-truncate\">" +  y["term"] + "</p>" +
                        "</div>" +
                    "</div>" +
                    "<div class=\"col-2 btn_add d-flex justify-content-center align-items-center\">" +
                        "<input type='checkbox'" + ((selected.has(x))? "checked" : "") + ">" +
                    "</div>" +
                "</div>" +
            "</div>"
        );

        // Add event listener for the add button on the card:

        $("#card-" + x + " > div > div:last-child > input").on("click", function (event) {
            event.stopPropagation();
            refreshSelectedBox(x, !$(this).is(":checked"));
        });

        // Chart Preview (left column)
        let str = "", max = 0, total = 0, count = 0;
        for(let z in grades){
            let cur = parseInt(grades[z]);
            if(cur > max) max = cur;
            total += cur;
            count++;
        }
        max *= 1.2;
        let colWidth = 100/count;
        for(let z of Object.values(grades)){
            let grad = Math.ceil((1 - z/max) * 100);
            str += "<div class=\"d-inline-block h-100\" style=\"width: " + colWidth + "%; background: linear-gradient(to bottom, #ced4da " + grad + "%, " + '#343a40' + " " + grad + "%);\"></div>";
        }
        $("#card-" + x + " > div > .class-graph").append(str);

        // Show only 'maxResults' number of results
        --remain;
    }
}

/**
 * Shows the chart on the right side of the page.
 * Either the index of the class to be shown, or an object with
 * more details about the chart to be shown is sent as a paramter.
 *
 * @param {Number | Object}
 */
function showMainChart(data){

    if(data.isPrototypeOf(String) || Number.isInteger(data)) data = {"indices": [parseInt(data)]};    // Make it an object if input is an index
    data.append = false;    // TO BE REMOVED LATER
    const gradeKeys = ['A+', 'A', 'A-',
        'B+', 'B', 'B-',
        'C+', 'C', 'C-',
        'D+', 'D', 'D-',
        'F', 'I', 'W',
        'CR', 'NC', 'P'];
    const colors = ['#2eb43f', '#30c737', '#6bd40f',
        '#93d10d', '#cdff4f', '#ffe14d',
        '#ffd036', '#ffc023', '#ffad33',
        '#ff704d', '#f54ad7', '#f500a0',
        '#dc3545', '#336eb4', "#dc4050"];

    let chart = ((data.append) ? $("#main-chart").highcharts() : undefined);
    let total;
    const onlyOneClass = !data.append && data.indices.length === 1;

    /* Hide the hint-text */

    $("#hint-text").hide();

    /* Clear Button */

    $("#btn_clear_chart").off("click").on("click", () => {
        $("#main-chart").empty();
        $("#btn_reddit").hide();
        $("#btn_rmp").hide();
        $("#btn_share").hide();
        $("#btn_share").popover('hide');
    }).css("display", "block");

    /* Prepare the screen */

    let rightArea = $("#right_area_container");
    if(rightArea.css("display") === "none") {
        /* For mobile devices */
        $("#btn_back").off("click").on("click", function(){
            rightArea.slideUp(300, function() {
                $("#left-bar").show(0, () => {if(onlyOneClass) window.location.hash = "#card-" + data.indices[0];});
            });
            $("#btn_share").popover('hide');
        }).show(() => $("#left-bar").hide(0, () => {
            rightArea.css("display", "flex");
        }));
    } else {
        $("#btn_share").popover('hide');
    }

    /* Calculate the total number of students -- To display it in the subtitile.
     *
     * If merge is true, this total value is used.
     * Else, it is calculated separately for each class later.
     */
    total = 0;
    for(index of data.indices)
        total += Object.values(database[index]["grades"]).reduce((a, b) => a + parseInt(b), 0);


    /* Prepare the chart */

    if(onlyOneClass){
        /* If only single class with 'append' set to false */
        let index = data.indices[0];
        let {subj, num, sect, prof, term, grades} = database[index];
        let search_phrase = prof.split(',').reverse().map(a => {
            return a.split(' ').map(a => (a.length > 1) ? a : "").join(' ');
        }).join(' ');
        data.title = data.title || subj + ' ' + num + '.' + sect;
        data.subtitle = data.subtitle || prof + ' - ' + term + ' - ' + Object.values(grades).reduce((a, b) => a + parseInt(b), 0) + ' Students';

        /* RMP, Reddit, and Share Buttons */

        $("#btn_rmp").off("click").on("click", function () {
            window.open("https://www.ratemyprofessors.com/search.jsp?query=" + encodeURI(search_phrase + " UT Dallas"), "_blank");
        }).css("display", "block");

        $("#btn_reddit").off("click").on("click", function () {
            window.open("https://www.reddit.com/r/utdallas/search/?q=" + encodeURI(search_phrase) + "&restrict_sr=1", "_blank");
        }).css("display", "block");

        $("#btn_share").attr("data-content", () => {
            return window.location.origin + "/utd-grades/?id=" + index;
        }).css("display", "block");
    }else{
        $("#btn_rmp").hide();
        $("#btn_reddit").hide();
        $("#btn_share").hide();
    }

    if(!data.append) {
        chart = Highcharts.chart('main-chart', {
            chart: {
                type: 'column',
                backgroundColor: '#f8f9fa'
            },
            title: {
                text: data.title || "Combined Grade Distributions Chart (Beta)"
            },
            subtitle: {
                text: data.subtitle || "Total: " + total + " students"
            },
            legend: {
                enabled: !onlyOneClass
            },
            credits: {
                enabled: false
            },
            xAxis: {
                title: {
                    text: 'Grades'
                },
                type: "category"
            },
            yAxis: {
                title: {
                    text: 'Percentage'
                }
            },
            tooltip: {
                formatter: function(){
                    /* https://api.highcharts.com/highcharts/tooltip.formatter */
                    let nameHTML, grade, studentsWithCurGrade, total;

                    if(data.merge){
                        nameHTML = ((function(){
                            let name = this.points.map((val)=>val.series.name);
                            res = "";
                            for(let i of name){
                                res += "<tr><td class=\"text-truncate\" style='font-size:10px; max-width: 30ch'><b>" + i + "</b></td></tr>";
                            }
                            return res;
                        }).bind(this))();
                        grade = this.points[0].key;
                        studentsWithCurGrade = this.points.map((val)=>val.point.studentsWithCurGrade).reduce((a, b) => a + b, 0);
                        total = this.points[0].point.size;
                    } else{
                        nameHTML = "<td class=\"text-truncate\" style='font-size:10px; max-width: 30ch'><b>" + this.series.name + "</b></td>";
                        grade = this.point.name;
                        studentsWithCurGrade = this.point.studentsWithCurGrade;
                        total = this.point.size;
                    }
                    let percentage = (studentsWithCurGrade * 100 /total).toFixed(2);

                    return `
                        <table>`
                        + nameHTML +
                        `<tr>
                                <td style='color:#343a40;padding:0'>` + grade + ` : </td>
                                <td style='padding:0'><b>` + studentsWithCurGrade + `</b> students</td>
                            </tr>
                            <tr>
                                <td style='color:#343a40;padding:0'>Out of : </td>
                                <td style='padding:0'><b>` + total + `</b> students</td>
                            </tr>
                            <tr>
                                <td style='color:#343a40;padding:0'>Percentage: </td>
                                <td style='padding:0'><b>` + percentage + `%</b></td>
                            </tr>
                        </table>
                    `
                },
                backgroundColor: '#f8f9fa',
                borderColor: '#ced4da',
                borderRadius: 6,
                useHTML: true,

                /*
                 * If 'shared' is true, only one tooltip is shown for points with the same key,
                 * although they belong to different series (tooltip is shared).
                 */

                shared: data.merge
            }, plotOptions: {
                column: {
                    stacking: 'normal'
                },

                /*
                 * A work-around for a bug in HighCharts. The chart overflows and hides the
                 * legend on first render. The reflow() function is called to prevent that.
                 */

                series: {
                    animation: {
                        complete: function () {
                            $("#main-chart").highcharts().reflow();
                        }
                    }
                }
            },
            series:(function(){
                let res = [];
                let centPertotal = 100/total;
                for(index of data.indices){
                    let {term, subj, num, sect, grades} = database[index];
                    let combinedString = subj + " " + num + " " + sect + " " + term;
                    if(!data.merge){
                        /* If merge is false, calculate the total here individually.
                        * This replaces the total (and centpertotal) calculated previously. */
                        total = Object.values(grades).reduce((a, b) => a + parseInt(b), 0);
                        centPertotal = 100 / total;
                    }
                    res.push({
                        "name": combinedString,
                        "stack": (data.merge) ? (data.stackName || "") : combinedString,
                        "data": (function(){
                            let res = [];
                            for (let i in grades) {
                                let index = gradeKeys.indexOf(i);
                                let studentsWithCurGrade = parseInt(grades[i]);
                                res.push({
                                    name: i,
                                    "studentsWithCurGrade" : studentsWithCurGrade,
                                    "size": total,
                                    y: studentsWithCurGrade * centPertotal,
                                    color: (index === -1) ? '#2986ff' : colors[index]
                                });
                            }
                            return res;
                        })()
                    })
                }
                return res;
            })()
        },(chart)=> {
            /*
             * For some weird reason, the array chart.xAxis[0].names, along with all the xAxis names, has
             * a dictionary called 'keys' at the end. It couldn't be removed with the pop() function. If this
             * array has 'n' elements, the 'keys' element is the 'n+1' element (don't know why). Only map((o)=>o)
             * solved this problem.
             */
            chart.xAxis[0].setCategories(chart.xAxis[0].names.sort((o1, o2) => gradeKeys.indexOf(o1) - gradeKeys.indexOf(o2)).map((o)=>o));
        });
    }
}

/**
 * Updates the "selected" box
 * If there are no classes left in the box, the box is hidden.
 * If the box is hidden and an item is added, box is shown.
 *
 * @param {Number | Array} arg
 * @param {Boolean} Only applicable when arg is a number >= 0.
 *
 * If a number, it is either:
 * 1. the ID of the class to be added/removed.
 * 2. -1 - add all the classes that are in the "selected" box to the chart individually.
 * 3. -2 - All the classes in the "selected" box to the chart in a stacked way.
 * 4. -1, -2, -3 - clear all the classes in the "selected" box (happens for -1 and -2 as well).
 *
 * If an array is given, all the elements in the array are added/removed from the 'selected' array
 * according to 'remove' argument. It defaults to false.
 *
 * Classes in nested arrays are stacked into one bar when the chart is displayed
 * (this only happens when the input is parsed from the URL. Website UI does not
 * create nested arrays).
 */

function refreshSelectedBox(arg, remove){
    if(Array.isArray(arg)){
        for(let i of arg) change(i, remove);
    } else {
        switch (arg) {
            case -1:
            case -2:
                showMainChart({
                    append: true,
                    merge: (arg === -2),
                    indices: Array.from(selected)
                });
            case -3:
                selected.clear();
                $("#selected-box").fadeOut(()=>$("#selected-box-content").empty());
                $(".class-info-card > div > div:last-child > input").prop("checked", false);
                $("#search-selectAll").prop("checked", false);
                break;
            default:
                change(arg, remove);
        }
    }

    function change(arg, remove){
        if(!remove && !selected.has(arg)){
            selected.add(arg);
            if($("#selected-box").is(":hidden")) $("#selected-box").fadeIn();
            $("#selected-box-content").append(()=>{
                let y = database[arg];
                return "<div class=\"flex-grow-0 bg-secondary border-right d-flex justify-content-center align-items-center\" id=\"selected-" + arg + "\" style='display: none'>" +
                    "<p class=\"text-white m-3 m-md-2\">" + y["subj"] + " " + y["num"] + " " + y["sect"] + "</p></div>"
            });
            $("#selected-" + arg).fadeIn();
        } else if(remove && selected.has(arg)){
            selected.delete(arg);
            $("#selected-" + arg).fadeOut(()=>{
                $("#selected-" + arg).remove();
                if(selected.size === 0) $("#selected-box").fadeOut();
            });
        }
    }
}