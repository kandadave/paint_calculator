const BASE_URL = 'https://paint-calculator-server.onrender.com';

// Custom message box function
function showMessage(message, isError = false) {
    const messageBox = document.getElementById('messageBox');
    messageBox.textContent = message;
    messageBox.className = 'message-box'; // Reset classes
    if (isError) {
        messageBox.classList.add('error');
    }
    messageBox.style.display = 'block';
    setTimeout(() => {
        messageBox.style.display = 'none';
    }, 6000); // Hide after 6 seconds
}

// Global variables to store fetched rates
let PAINT_CATEGORY_COSTS_PER_SQM = {};
let COAT_MULTIPLIERS = {};
let LABOUR_RATE_PER_SQM = 0;
let TRANSPORT_RATE = 0;
let OVERHEAD_PERCENTAGE = 0;
let currentQuotationData = null; // To store the last calculated quotation 
let editingQuotationId = null; // To track if we're editing a quotation

// Helper function to fetch data from a given URL, handle HTTP errors, and parse JSON.
function fetchJson(url, options = {}) {
    return fetch(url, options)
        .then(response => {
            if (!response.ok) {
                // Try to parse error message from response body, fallback to statusText
                return response.json()
                    .catch(() => ({ message: response.statusText }))
                    .then(errorData => {
                        throw new Error(`HTTP error! Status: ${response.status} - ${errorData.message || 'Unknown error'}`);
                    });
            }
            return response.json();
        });
}

// Fetches initial rates from the server.
function fetchRates() {
    fetchJson(`${BASE_URL}/rates`)
        .then(rates => {
            PAINT_CATEGORY_COSTS_PER_SQM = rates.paintCategoryCostsPerSqm;
            COAT_MULTIPLIERS = rates.coatMultipliers;
            LABOUR_RATE_PER_SQM = rates.labourRatePerSqm;
            TRANSPORT_RATE = rates.transportRate;
            OVERHEAD_PERCENTAGE = rates.overheadPercentage;

            showMessage('Rates loaded successfully');
            document.getElementById('calculateBtn').disabled = false; // Enable form
        })
        .catch(error => {
            showMessage('Failed to load rates. Please ensure JSON server is running and db.json is correctly configured.', true);
            console.error('Error fetching rates:', error);
            document.getElementById('calculateBtn').disabled = true; // Disable form
        });
}


//Renders the currently calculated/edited quotation in the main output area.
function renderCurrentQuotation(data) {
    const quotationOutputDiv = document.getElementById('quotationOutput');
    quotationOutputDiv.innerHTML = ''; // Clear previous content

    // Ensure quotationOutputDiv exists
    if (!quotationOutputDiv) {
        console.error("Error: 'quotationOutput' element not found in HTML.");
        return;
    }

    if (!data) {
        quotationOutputDiv.classList.add('hidden');
        // Ensure actionButtons exists before trying to manipulate it
        const actionButtonsDiv = document.getElementById('actionButtons');
        if (actionButtonsDiv) {
            actionButtonsDiv.classList.add('hidden');
        }
        document.getElementById('noQuotationMessage').classList.remove('hidden');
        return;
    }

    // Client Details
    quotationOutputDiv.innerHTML += `
        <p class="text-base"><strong>Quotation No:</strong> ${data.id || 'N/A'}</p>
        <p class="text-base"><strong>Client:</strong> ${data.fullName} (${data.email})</p>
        <p class="text-base"><strong>Phone:</strong> ${data.phone}</p>
    `;

    // Painting Details
    quotationOutputDiv.innerHTML += `
        <p class="text-base"><strong>Area:</strong> ${data.area} sq meters</p>
        <p class="text-base"><strong>Coats:</strong> ${data.coats}</p>
        <p class="text-base"><strong>Paint Usage:</strong> ${data.paintType}</p>
        <p class="text-base"><strong>Paint Category:</strong> ${data.paintCategory}</p>
        <hr class="border-t border-gray-200 my-4">
    `;

    // Cost Breakdown Header
    quotationOutputDiv.innerHTML += `<h4 class="text-xl font-semibold text-gray-800">Cost Breakdown:</h4>`;

    // Cost Breakdown List
    const ul = document.createElement('ul');
    ul.className = 'list-disc list-inside space-y-2';
    ul.innerHTML = `
        <li>Estimated Paint Material Cost: <span class="font-semibold text-indigo-600">${data.estimatedPaintMaterialCost}</span> KES</li>
        <li>Estimated Labour Cost: <span class="font-semibold text-indigo-600">${data.estimatedLabourCost}</span> KES</li>
        <li>Estimated Transport Cost: <span class="font-semibold text-indigo-600">${data.estimatedTransportCost}</span> KES</li>
        <li>Miscellaneous & Overhead(${data.overheadPercentage}%): <span class="font-semibold text-indigo-600">${data.miscellaneousCost}</span> KES</li>
    `;
    quotationOutputDiv.appendChild(ul);

    // Grand Total
    quotationOutputDiv.innerHTML += `
        <p class="text-2xl font-extrabold text-indigo-700 mt-6">
          Estimated Grand Total: <span class='font-semibold'>${data.grandTotal}</span> KES
        </p>
    `;

    // Dynamic Creation of actionButtons Div 
    let actionButtonsDiv = document.getElementById('actionButtons');
    if (!actionButtonsDiv) {
        actionButtonsDiv = document.createElement('div');
        actionButtonsDiv.id = 'actionButtons';
        // Append it to parent, it should be right after quotationOutputDiv
        quotationOutputDiv.after(actionButtonsDiv);
    }
    actionButtonsDiv.innerHTML = ''; // Clear existing buttons if it already existed

    const editButton = document.createElement('button');
    editButton.className = 'inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-yellow-600 hover:bg-yellow-700';
    editButton.textContent = 'Edit Quotation';
    editButton.addEventListener('click', () => populateFormForEdit(data));

    const deleteButton = document.createElement('button');
    deleteButton.className = 'inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700';
    deleteButton.textContent = 'Delete Quotation';
    deleteButton.addEventListener('click', () => deleteQuotation(data.id || null));

    actionButtonsDiv.appendChild(editButton);
    actionButtonsDiv.appendChild(deleteButton);

    // Show quotation output and action buttons, hide initial message
    quotationOutputDiv.classList.remove('hidden');
    actionButtonsDiv.classList.remove('hidden'); // Ensure it's shown if it was hidden
    document.getElementById('noQuotationMessage').classList.add('hidden');
}

//Render quotation history function
function renderHistoryQuotations(quotations) {
    const quoteHistory = document.getElementById('quotation-history');
    quoteHistory.innerHTML = ''; // Clear previous content

    if (!quotations || !Array.isArray(quotations) || quotations.length === 0) {
        quoteHistory.innerHTML = '<p class="text-gray-500">No quotation found in history</p>';
        return;
    }

    quotations.forEach(data => {
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

        // Cost Breakdown List
        const ul = document.createElement('ul');
        ul.className = 'list-disc list-inside space-y-2';
        ul.innerHTML = `
            <li>Estimated Paint Material Cost: <span class="font-semibold text-indigo-600">${data.estimatedPaintMaterialCost}</span> KES</li>
            <li>Estimated Labour Cost: <span class="font-semibold text-indigo-600">${data.estimatedLabourCost}</span> KES</li>
            <li>Estimated Transport Cost: <span class="font-semibold text-indigo-600">${data.estimatedTransportCost}</span> KES</li>
            <li>Miscellaneous & Overhead(${data.overheadPercentage}%): <span class="font-semibold text-indigo-600">${data.miscellaneousCost}</span> KES</li>
        `;
        quoteDiv.appendChild(ul);

        // Grand Total
        quoteDiv.innerHTML += `
            <p class="text-2xl font-extrabold text-indigo-700 mt-6">
                Estimated Grand Total: <span class="font-semibold">${data.grandTotal}</span> KES
            </p>
        `;

        // Action Buttons for History Quotation
        const historyActionButtons = document.createElement('div');
        historyActionButtons.className = 'flex flex-col sm:flex-row justify-center gap-4 mt-6';
        // Use an anonymous function to ensure `data` is correctly captured
        historyActionButtons.innerHTML = `
            <button onclick='populateFormForEdit(${JSON.stringify(data).replace(/'/g, "\\'")})' class="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-yellow-600 hover:bg-yellow-700">Edit Quotation</button>
            <button onclick="deleteQuotation(${data.id || 'null'})" class="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700">Delete Quotation</button>
        `;
        quoteDiv.appendChild(historyActionButtons);
        quoteHistory.appendChild(quoteDiv);
    });
}


//Fetches and displays all quotation history.
function fetchAndRenderHistory() {
    fetchJson(`${BASE_URL}/quotations`)
        .then(data => {
            renderHistoryQuotations(data);
        })
        .catch(error => {
            showMessage('Failed to load quotation history.', true);
            console.error('Error fetching quotation history:', error);
        });
}


//Populates the form fields with data of an existing quotation for editing.
function populateFormForEdit(data) {
    if (!data) {
        showMessage('No quotation to edit', true);
        return;
    }
    // Populate form fields
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

    // Set editing mode
    editingQuotationId = data.id || null;
    document.getElementById('calculateBtn').textContent = 'Update Quotation';
    showMessage('Editing quotation. Update and submit to save changes.');

    // Scroll to the form
    document.getElementById('quotationForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

//Deletes a quotation from the server and updates the UI.
function deleteQuotation(id) {
    if (!id) {
        showMessage('Cannot delete unsaved quotation.', true);
        return;
    }
    if (!confirm('Are you sure you want to delete this quotation?')) return;

    fetchJson(`${BASE_URL}/quotations/${id}`, {
            method: 'DELETE'
        })
        .then(() => {
            showMessage('Quotation deleted successfully');
            fetchAndRenderHistory(); // Refresh history

            // Clear current quotation if it was deleted
            if (currentQuotationData && currentQuotationData.id === id) {
                document.getElementById('quotationForm').reset();
                renderCurrentQuotation(null); // Clear the current quotation display
                currentQuotationData = null;
                editingQuotationId = null;
                document.getElementById('calculateBtn').textContent = 'Calculate Quotation';
            }
        })
        .catch(error => {
            showMessage('Failed to delete quotation.', true);
            console.error('Error deleting quotation', error);
        });
}

// Handles the submission of the quotation form (both new and updates).
function handleQuotationFormSubmit(event) {
    event.preventDefault(); // Prevent default form submission

    // Get input values
    const fullName = document.getElementById('fullName').value;
    const email = document.getElementById('email').value;
    const phone = document.getElementById('phone').value;
    const area = parseFloat(document.getElementById('area').value);
    const coats = document.getElementById('coats').value;
    const paintTypeElement = document.querySelector('input[name="paintType"]:checked');
    const paintType = paintTypeElement ? paintTypeElement.value : '';
    const paintCategory = document.getElementById('paintCategory').value;
    const paintCategoryText = document.getElementById('paintCategory').options[document.getElementById('paintCategory').selectedIndex].text;

    // Basic input validation
    if (!fullName || !email || !phone || isNaN(area) || area <= 0 || !coats || !paintType || !paintCategory) {
        showMessage('Please fill in all required fields correctly.', true);
        return;
    }

    // Ensure rates are loaded before calculation
    if (Object.keys(PAINT_CATEGORY_COSTS_PER_SQM).length === 0 || LABOUR_RATE_PER_SQM === 0 || TRANSPORT_RATE === 0) {
        showMessage('Rates are still loading or failed to load. Please ensure JSON Server is running and reload the page if needed.', true);
        return;
    }

    // Perform Calculation using fetched rates
    const basePainCostPerSqm = PAINT_CATEGORY_COSTS_PER_SQM[paintCategory] || 0;
    const coatMultiplier = COAT_MULTIPLIERS[coats] || 1.0;

    const estimatedPaintMaterialCost = area * basePainCostPerSqm * coatMultiplier;
    const estimatedLabourCost = area * LABOUR_RATE_PER_SQM;
    const estimatedTransportCost = TRANSPORT_RATE;
    const miscellaneousCost = (estimatedPaintMaterialCost + estimatedLabourCost + estimatedTransportCost) * OVERHEAD_PERCENTAGE;
    const grandTotal = estimatedPaintMaterialCost + estimatedLabourCost + estimatedTransportCost + miscellaneousCost;

    // Format numbers to 2 decimal places for currency
    const formatCurrency = (amount) => amount.toFixed(2);

    // Prepare quotation data for display and submission
    const quotationDataToSave = {
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
    };

    let requestMethod = 'POST';
    let requestUrl = `${BASE_URL}/quotations`;
    let successMessage = 'Quotation calculated and saved successfully!';
    let errorMessagePrefix = 'Failed to save quotation';

    if (editingQuotationId) {
        requestMethod = 'PUT'; // Use PUT for full resource update
        requestUrl = `${BASE_URL}/quotations/${editingQuotationId}`;
        quotationDataToSave.id = editingQuotationId; // Include ID for PUT
        successMessage = 'Quotation updated successfully!';
        errorMessagePrefix = 'Failed to update quotation';
    }

    // Send quotation data to JSON server
    fetchJson(requestUrl, {
            method: requestMethod,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(quotationDataToSave)
        })
        .then(savedQuotation => {
            currentQuotationData = savedQuotation; // Store the returned quotation including its ID
            showMessage(successMessage, false);
            console.log(`Quotation ${editingQuotationId ? 'updated' : 'saved'} to JSON Server:`, savedQuotation);

            // Render the newly saved/updated quotation in the main display
            renderCurrentQuotation(savedQuotation);

            // Reset editing state and form
            editingQuotationId = null;
            document.getElementById('calculateBtn').textContent = 'Calculate Quotation';
            document.getElementById('quotationForm').reset();

            // Refresh history
            fetchAndRenderHistory();
        })
        .catch(error => {
            showMessage(`${error.message}`, true);
            console.error('Error sending data to JSON Server:', error);
        });
}

// Main function to initialize the application logic.
function main() {
    // Get references to form elements
    const quotationForm = document.getElementById('quotationForm');
    document.getElementById('calculateBtn').disabled = true;

    fetchRates(); // Fetch rates when the DOM is ready
    fetchAndRenderHistory(); // Fetch and render quotation history on page load

    // Attach event listener for form submission
    quotationForm.addEventListener('submit', handleQuotationFormSubmit);
}

// Initialize the application when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', main);

