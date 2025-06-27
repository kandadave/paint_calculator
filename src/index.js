const BASE_URL = 'https://paint-calculator-server.onrender.com' 
//Custom message box function 
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
    }, 4000) //Hide after 4 seconds
}

//Global variables to store fetched rates
let PAINT_CATEGORY_COSTS_PER_SQM = {};
let COAT_MULTIPLIERS = {};
let LABOUR_RATE_PER_SQM = 0;
let TRANSPORT_RATE = 0;
let OVERHEAD_PERCENTAGE = 0; 
let currentQuotationData = null; //To store the last calculated quotation for copy/download
let editingQuotationId = null; //To track if we're editing a quotation

function fetchRates(){
    fetch(`${BASE_URL}/rates`)
      .then( response => {
        if(!response.ok){
            //If response is not OK, throw an error to be caught by .catch()
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json() //Parse JSON form the response
      })
      .then(rates => {
        //Assign fetched rates to global variables
        PAINT_CATEGORY_COSTS_PER_SQM = rates.paintCategoryCostsPerSqm;
        COAT_MULTIPLIERS = rates.coatMultipliers;
        LABOUR_RATE_PER_SQM = rates.labourRatePerSqm;
        TRANSPORT_RATE = rates.transportRate;
        OVERHEAD_PERCENTAGE = rates.overheadPercentage;

        showMessage('Rates loaded successfully');
        // console.log('Rates fetched:', rates);

        //Enable the form once the rates are loaded 
        document.getElementById('calculateBtn').disabled = false;
      })
      .catch(error => {
        showMessage('Failed to load rates. Please ensure JSON server is running on port 3000 and db.json is correctly configured.', true);
        // console.error('Error fetching rates:', error)
        //Disable form if rates cannot be loaded 
        document.getElementById('calculateBtn').disabled = true;
      })
}

function renderQuotation(data) {
    const quotationOutputDiv = document.getElementById('quotationOutput');
    quotationOutputDiv.innerHTML = ''; //Clear previous content

    //Client Details
    quotationOutputDiv.innerHTML += `
        <p class="text-base"><strong>Quotation No:</strong> ${data.id || 'N/A'}</p>
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
        <li>Miscellaneous & Overhead(${data.overheadPercentage}%): <span class="font-semibold text-indigo-600">${data.miscellaneousCost}</span> KES</li> 
    `;
    quotationOutputDiv.appendChild(ul);

    //Grand Total
    quotationOutputDiv.innerHTML += `
        <p class="text-2xl font-extrabold text-indigo-700 mt-6">
          Estimated Grand Total: <span class='font-semibold'>${data.grandTotal}</span> KES
        </p>
    `

    //Action Buttons for Current Quotation
    const currentActionButtons = document.createElement('div');
    currentActionButtons.className = 'flex flex-col sm:flex-row justify-center gap-4 mt-6'
    //Add action buttons with html attribute events.(also stringify the data and  replace all " with $quot; to prevent errors)
    currentActionButtons.innerHTML = `        
        <button onclick="editQuotation(${JSON.stringify(data).replace(/"/g, '&quot;')})" class="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-yellow-600 hover:bg-yellow-700">Edit Quotation</button>
        <button onclick="deleteQuotation(${data.id || 'null'})" class="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700">Delete Quotation</button>
    `
    quotationOutputDiv.appendChild(currentActionButtons)

    //Show quotation output and action buttons, hide initial message
    quotationOutputDiv.classList.remove('hidden');
    document.getElementById('actionButtons').classList.remove('hidden');
    document.getElementById('noQuotationMessage').classList.add('hidden');
}

function renderHistoryQuotation(data) {
    const quoteHistory = document.getElementById('quotation-history')    
    quoteHistory.innerHTML = ''; //Clear previous content

    if(!data || !Array.isArray(data) || data.length === 0){
        quoteHistory.innerHTML = '<p class="text-gray-500">No quotation found in history</p>';
        return;
    }

    data.forEach(data => {
        const quoteDiv = document.createElement('div');
        quoteDiv.className = 'border border-gray-200 p-4 mb-4 rounded-md shadow-sm';

    // Client Details
    quoteDiv.innerHTML = `
        <p class="text-base"><strong>Quotation No:</strong> ${data.id || 'N/A'}</p>
        <p class="text-base"><strong>Client:</strong> ${data.fullName} (${data.email})</p>
        <p class="text-base"><strong>Phone:</strong> ${data.phone}</p>
        <p class="text-base"><strong>Area:</strong> ${data.area} sq meters</p>
        <p class="text-base"><strong>Coats:</strong> ${data.coats}</p>
        <p class="text-base"><strong>Paint Usage:</strong> ${data.paintType}</p>
        <p class="text-base"><strong>Paint Category:</strong> ${data.paintCategory}</p>
        <hr class="border-t border-gray-200 my-4">
        <h4 class="text-xl font-semibold text-gray-800">Cost Breakdown:</h4>
    `;

    //Cost Breakdown List
    const ul =document.createElement('ul');
    ul.className = 'list-disc list-inside space-y-2';
    ul.innerHTML = `
        <li>Estimated Paint Material Cost: <span class="font-semibold text-indigo-600">${data.estimatedPaintMaterialCost}</span> KES</li>
        <li>Estimated Labour Cost: <span class="font-semibold text-indigo-600">${data.estimatedLabourCost}</span> KES</li>
        <li>Estimated Transport Cost: <span class="font-semibold text-indigo-600">${data.estimatedTransportCost}</span> KES</li>
        <li>Miscellaneous & Overhead(${data.overheadPercentage}%): <span class="font-semibold text-indigo-600">${data.miscellaneousCost}</span> KES</li>
    `;
    quoteDiv.appendChild(ul)

    //Grand Total
    quoteDiv.innerHTML += `
        <p class="text-2xl font-extrabold text-indigo-700 mt-6">
            Estimated Grand Total: <span class="font-semibold">${data.grandTotal}</span> KES
        </p>
    `

    //Action Buttons for Current Quotation
    const currentActionButtons = document.createElement('div');
    currentActionButtons.className = 'flex flex-col sm:flex-row justify-center gap-4 mt-6'
    //Add action buttons with html attribute events.(also stringify the data and  replace all " with $quot; to prevent errors)
    currentActionButtons.innerHTML = `
        <button onclick="editQuotation(${JSON.stringify(data).replace(/"/g, '&quot;')})" class="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-yellow-600 hover:bg-yellow-700">Edit Quotation</button>
        <button onclick="deleteQuotation(${data.id || 'null'})" class="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700">Delete Quotation</button>
    `
    quoteDiv.appendChild(currentActionButtons)
    //Append the quotation div to the history section
    quoteHistory.appendChild(quoteDiv);

    });
}



function editQuotation(data) {
    if (!data) {
        showMessage('No quotation to edit', true);
        return;
    }
    //Populate form fields
    document.getElementById('fullName').value = data.fullName;
    document.getElementById('email').value = data.email;
    document.getElementById('phone').value = data.phone;
    document.getElementById('area').value = data.area;
    document.getElementById('coats').value = data.coats;
    document.querySelector(`input[name="paintType"][value="${data.paintType.toLowerCase()}"]`).checked = true;
    const paintCategoryValue = Object.keys(PAINT_CATEGORY_COSTS_PER_SQM).find(key =>
        document.querySelector(`#paintCategory option[value="${key}"]`).text === data.paintCategory
    );
    document.getElementById('paintCategory').value = paintCategoryValue || '';

    //Set editing mode
    editQuotationId = data.id || null;
    document.getElementById('calculateBtn').textContent = 'UpdateQuotation';
    showMessage('Editing quotation. Update and submit to save changes.');
}

function deleteQuotation(id){
    if(!id){
        showMessage('Cannot delete unsaved quotation.', true)
        return;
    }
    if (!confirm('Are you sure you want to relete this quotation?')) return;

    fetch(`${BASE_URL}/${id}`, {
        method: 'DELETE'
    })
        .then(res => {
            if(!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }
            showMessage('Quotation deleted successfully')
            //Refresh history
            fetch(`${BASE_URL}/quotations`)
                .then(res => res.json())
                .then(data => renderHistoryQuotation(data))
                .catch(error => {
                    showMessage('Failed to refresh quotation history',true);
                    console.error('Error refreshing history:', error);
                });                

            //Clear current quotation if it was deleted
            if (currentQuotationData && currentQuotationData.id === id) {
                document.getElementById('quotationForm').reset();
                document.getElementById('quotationOutput').classList.add('hidden');
                document.getElementById('actionButtons').classList.add('hidden');
                document.getElementById('noQuotationMessage').classList.remove('hidden');
                currentQuotationData = null;
                editingQuotationId = null;
                document.getElementById('calculateBtn').textContent = 'Calculate Quotation';

            }
        })
        .catch(error => {
            showMessage('Failed to delete quotation.', true)
            console.error('Error deleting quotation', error);
        })
}

document.addEventListener('DOMContentLoaded', function() {
    //Get references to form and output elements
    const quotationForm = document.getElementById('quotationForm');
   
    document.getElementById('calculateBtn').disabled = true;
    
    fetchRates(); // Fetch rates when the DOM is ready

    //Fetch and render quotation history on page load
    fetch(`${BASE_URL}/quotations`)
        .then(res => {
            if(!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`)
            }
            return res.json()
        })
        
        .then(data => {
            renderHistoryQuotation(data)//Render all quotation initially
        })
        .catch(error => {
            showMessage('Failed to load quotation history.', true)
            console.error('Error fetching quotation history:', error)
        })

    // Form submission handler
    
    quotationForm.addEventListener('submit', function(event) {
        console.log('Attempted form submission')
        event.preventDefault(); //Prevent default form submission

        //Get input values
        const fullName = document.getElementById('fullName').value;
        const email = document.getElementById('email').value;
        const phone = document.getElementById('phone').value;
        const area = parseFloat(document.getElementById('area').value);
        const coats = document.getElementById('coats').value;
        const paintTypeElement = document.querySelector('input[name="paintType"]:checked'); //Get checked radio button
        const paintType = paintTypeElement ? paintTypeElement.value : ''; // Get value of checked radio button
        const paintCategory = document.getElementById('paintCategory').value;
        const paintCategoryText = document.getElementById('paintCategory').options[document.getElementById('paintCategory').selectedIndex].text;//Gets the text that the user selects from HTMLOptionsCollection

        //Basic input validation
        if (!fullName || !email || !phone || isNaN(area) || area <= 0 || !coats || !paintType || !paintCategory) {
            showMessage('Please fill in all required fields correctly.', true);
            return;
        }

        //Ensure rates are loaded before calculation
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
        const miscellaneousCost = (estimatedPaintMaterialCost + estimatedLabourCost + estimatedTransportCost) * OVERHEAD_PERCENTAGE;
        const grandTotal = estimatedPaintMaterialCost + estimatedLabourCost + estimatedTransportCost + miscellaneousCost;

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
            estimatedLabourCost: formatCurrency(estimatedLabourCost),
            estimatedTransportCost: formatCurrency(estimatedTransportCost),
            miscellaneousCost: formatCurrency(miscellaneousCost),
            grandTotal: formatCurrency(grandTotal),
            overheadPercentage: (OVERHEAD_PERCENTAGE * 100).toFixed(0), // For display
            timestamp: new Date().toISOString()
        }

        //Display Results in the right column dynamically
        renderQuotation(currentQuotationData)

        //Send current quotation data to JSON server
        fetch(`${BASE_URL}/quotations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(currentQuotationData)
        })
          .then(res => {
            if(!res.ok){
                //If not Ok, throw new error
                return res.json().then(errorData => {
                    throw new Error(errorData.message || res.statusText)
                })
            }
            return res.json();
          })
          .then(savedQuotation => {
            showMessage('Quotation calculated and saved successfully!', false);
            console.log('Quotation saved to JSON Server:', savedQuotation);

            //Fetch and render updated quotation history
            fetch(`${BASE_URL}/quotations`)
                .then(res => res.json())
                .then(data => {
                    renderHistoryQuotation(data) //Render updated history
                })
                .catch(error => {
                    showMessage('Failed to load updated quotation history', true);
                    console.error('Error fetching updated quotation history:,', error)
                })
          })

          .catch(error => {
            showMessage(`Failed to ${editingQuotationId ? 'update' : 'save'} quotation: ${error.message}`, true);
            console.error('Error sending data to JSON Server:', error);   
          });

    })

})
