//Custom message box function to replace aleart()
function showMessage(message, isError=false){
    const messageBox = document.getElementById('messageBox');
    messageBox.textContent = message;
    messageBox.className = 'message-box'; //Reset classes
    if (isError) {
        messageBox.classList.add('error');
    }
    messageBox.style.display = 'block';
    setTimeout(() => {
        messageBox.style.display = 'none';
    }, 3000) //Hide after 3 seconds
}

//Global variables to store fetched rates
let PAINT_CATEGORY_COSTS_PER_SQM = {};
let COAT_MULTIPLIERS = {};
let LABOUR_RATE_PER_SQM = 0;
let TRANSPORT_RATE = 0;
let OVERHEAD_PERCENTAGE = 0; 
let currentQuotationData = null; //To store the last calculated quotation for copy/download

function fetchRates(){
    fetch('http://localhost:3000/rates')
      .then( response => {
        if(!response.ok){
            //If response is not OK, throw an error to be caught by .catch()
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json() //Parse JSON form the response
      })
      .then(rates => {
        //Assign fetched rates to global variables
        PAINT_CATEGORY_COSTS_PER_SQM = rates.paintCategoryCostPerSqm;
        COAT_MULTIPLIERS = rates.coatMultipliers;
        LABOUR_RATE_PER_SQM = rates.labourRatesPerSqm;
        TRANSPORT_RATE = rates.transportRate;
        OVERHEAD_PERCENTAGE = rates.overheadPercentage;

        showMessage('Rates loaded successfully');
        console.log('Rates fetched:', rates);

        //Enable the form once the rates are loaded 
        document.getElementById('calculateBtn').disabled = false;
      })
      .catch(error => {
        showMessage('Failed to load rates. Please ensure JSON server is running on port 3000 and db.json is correctly configured.', true);
        console.error('Error fetching rates:', error)
        //Disable form if rates cannot be loaded 
        document.getELementsByID('calculateBtn').disabled = true;
      })
}

function renderQuotation(data) {
    const quotationOutputDiv = document.getElementById('quotationOutput');
    quotationOutputDiv.innerHTML = ''; //Clear previous content

    //Client Details
    quotationOutputDiv.innerHTML += `
        <p class="text-base"><strong>Client:</strong> ${data.fullName} (${data.email})</p>
        <p class="text-base"><strong>Phone:</strong> ${data.phone}</p>
        `;

    //Painting Details
    quotationOutputDiv.innerHTML += `
        <p class="text-base"><strong>Area:</strong> ${data.area} sq meters</p>
        <p class="text-base"><strong>Coats:</strong> ${data.coats}</p>
        <p class="text-base"><strong>Paint Usage:</strong> ${data.paintType}</p>
        <p class="text-base"><strong>Paint Category:</strong> ${data.paintCategory}</p>
        <hr class="border-t border-gray-200 my-4">
    `;

    //Cost Breakdowwn Header
    quotationOutputDiv.innerHTML += `<h4 class="text-xl font-semibold text-gray-800">Cost Breakdown:</h4>`;

    //Cost Breakdown List
    const ul = document.createElement('ul');
    ul.className = 'list-disc list-inside space-y-2'
    ul.innerHTML = `
        <li>Estimated Paint Material Cost: <span class="font-semibold text-indigo-600">${data.estimatedPaintMaterialCost}</span> KES</li> 
        <li>Estimated Labour Cost: <span class="font-semibold text-indigo-600">${data.estimatedLabourCost}</span> KES</li> 
        <li>Estimated Transport Cost: <span class="font-semibold text-indigo-600">${data.estimatedTransportCost}</span> KES</li> 
        <li>Miscellaneous $ Overhead(${data.overheadPercentage}): <span class="font-semibold text-indigo-600">${data.miscellaneousCost}</span> KES</li> 
    `;
    quotationOutputDiv.appendChild(ul);

    //Grand Total
    quotationOutputDiv.innerHTML += `
        <p class="text-2xl font-extrabold text-indigo-700 mt-6">
          Estimated Grand Total: <span class='font-semibold'>${data.grandTotal}</span> KES
        </p>
    `

    //Show quotation output and action buttons, hide initial message
    quotationOutputDiv.classList.remove('hidden');
    document.getElementById('actionButtons').classList.remove('hidden');
    document.getElementById('noQuotationMessage').classList.add('hidden');

    document.addEventListener('DOMContentLoaded', function() {
        //Get references to form and output elements
        const quotationForm = document.getElementById('quotationForm');
        const quotationOutputDiv = document.getElementById('quotationOutput');
        const noQuotationMessage = document.getElementById('noQuotationMessage');
        const actionButtonsDiv = document.getElementById('action Buttons')

        const copyQuotationBtn = document.getElementById('copyQuotationBtn');
        const downloadQuotationBtn = document.getElementById('downloadQuotationBtn');
        const resetQuotationBtn = document.getElementById('resetQuotationBtn');

        // Initially disable the calculate button until rates are loaded
        document.getElementById('calculateBtn').disabled = true;
        fetchRates(); // Fetch rates when the DOM is ready

        // Form submission handler
        quotationForm.addEventListener('submit', function(event) {
            event.preventDefault(); //Prevent default form submission

            //Get input values
            const fullName = document.getElementById('fullName').ariaValueMax;
            const email = document.getElementById('email').value;
            const phone = document.getElementById('phone').value;
            const area = parseFloat(document.getElementById('area').value);
            const coats = document.getElementById('coats').value;
            const paintTypeElement = document.querySelector('input[name="paintType];checked'); //Get checked radio button
            const paintType = paintTypeElement ? paintTypeElement.value : ''; // Get value of checked radio button
            const paintCategory = document.getElementById('paintCategory').value;
            const paintCategoryText = document.getElementById('paintCategory').options[document.getElementById('paintCategory').selectedIndex].text;//Gets the text that the user selects from HTMLOptionsCollection

            //Basic input validation
            if (!fullName || !email || !phone || isNaN(area) || area <= 0 || !coats || !paintType || !paintCategory) {
                    showMessage('Please fill in all required fields correctly.', true);
                    return;
            }

            //Ensure rates are loaded before calculatinh
            if(Object.keys(PAINT_CATEGORY_COSTS_PER_SQM).length === 0 || LABOUR_RATE_PER_SQM === 0 || TRANSPORT_RATE === 0){
                showMessage('Rates are still loading or failed to load. Please ensure JSON Server is running and reload the page if needed.', true);
                return;
            }

            //Perform Calculation using fetched rates
            const basePainCostPerSqm = PAINT_CATEGORY_COSTS_PER_SQM[paintCategory] || 0;
            const coatMultiplier = COAT_MULTIPLIERS[coats] || 1.0; 
            
            const estimatedPaintMaterialCost = area * basePainCostPerSqm * coatMultiplier;
            const estimatedLabourCost = area * LABOUR_RATE_PER_SQM;
            const estimatedTransportCost = TRANSPORT_RATE;
            const miscellaneousCost = (estimatedPaintMaterialCost + estimatedLaborCost + estimatedTransportCost) * OVERHEAD_PERCENTAGE;
            const grandTotal = estimatedPaintMaterialCost + estimatedLaborCost + estimatedTransportCost + miscellaneousCost;

            //Format numbers to 2 decimal places for currency
            const formatCurrency = (amount) => amount.toFixed(2)

            //Prepare quotation data for display and submission
            currentQuotationData = {
                fullName: fullName,
                email: email,
                phone: phone,
                area: area,
                coats: coats,
                paintType: paintType.charAt(0).toUpperCase() + paintType.slice(1),
                paintCategory: paintCategoryText,
                estimatedPaintMaterialCost: formatCurrency(estimatedPaintMaterialCost),
                estimatedLaborCost: formatCurrency(estimatedLaborCost),
                estimatedTransportCost: formatCurrency(estimatedTransportCost),
                miscellaneousCost: formatCurrency(miscellaneousCost),
                grandTotal: formatCurrency(grandTotal),
                overheadPercentage: (OVERHEAD_PERCENTAGE * 100).toFixed(0), // For display
                timestamp: new Date().toISOString()
            }

            //Display Results in the right column dynamically
            renderQuotation(currentQuotationData)

            //Send current quotation data to JSON server

            //Copy Quotation to Clipboard

            //Download Quotation

            //Send the quotation through email

            //Reset the form 


        })

    })
}