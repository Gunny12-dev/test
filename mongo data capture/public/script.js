const form = document.getElementById("captureForm");
const errName = document.getElementById("err-name");
const errSurname = document.getElementById("err-surname");
const errId = document.getElementById("err-idNumber");
const errDob = document.getElementById("err-dateOfBirth");
const message = document.getElementById("message");
const cancelBtn = document.getElementById("cancelBtn");

// Client-side validation
function validateClient(values) {
  const errors = {};
  //Validate Name
  if (!values.name || !/^[A-Za-zÀ-ÖØ-öø-ÿ'’\-\s]+$/u.test(values.name.trim()))
    errors.name = "Invalid name";
  //validate Surname
  if (!values.surname || !/^[A-Za-zÀ-ÖØ-öø-ÿ'’\-\s]+$/u.test(values.surname.trim()))
    errors.surname = "Invalid surname";
  //Validate ID Number
  if (!/^\d{13}$/.test(values.idNumber))
    errors.idNumber = "ID must be numeric and exactly 13 digits";
  //Validate Date of Birth
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(values.dateOfBirth))
    errors.dateOfBirth = "DOB must be dd/mm/YYYY";
  return errors;
}

// Clear errors
function clearErrors() {
  errName.textContent = "";
  errSurname.textContent = "";
  errId.textContent = "";
  errDob.textContent = "";
  message.textContent = "";
}

// Populate form with values
function populateForm(values) {
  if (!values) return;
  document.getElementById("name").value = values.name || "";
  document.getElementById("surname").value = values.surname || "";
  document.getElementById("idNumber").value = values.idNumber || "";
  document.getElementById("dateOfBirth").value = values.dateOfBirth || "";
}

// Cancel button
cancelBtn.addEventListener("click", () => {
  form.reset();
  clearErrors();
});

// Form submission
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearErrors();
  //creates an object values that stores input data from the form
  const values = {
    name: document.getElementById("name").value,
    surname: document.getElementById("surname").value,
    idNumber: document.getElementById("idNumber").value,
    dateOfBirth: document.getElementById("dateOfBirth").value,
    checkIdMatchesDob: document.getElementById("checkIdMatchesDob").checked,
  };
  //runs form data through a validation function
  const clientErrors = validateClient(values);

  
  if (Object.keys(clientErrors).length > 0) {
    //shows error message next to field if an error is found
    if (clientErrors.name) errName.textContent = clientErrors.name;
    if (clientErrors.surname) errSurname.textContent = clientErrors.surname;
    if (clientErrors.idNumber) errId.textContent = clientErrors.idNumber;
    if (clientErrors.dateOfBirth) errDob.textContent = clientErrors.dateOfBirth;
    //stops futher code execution untill errors are fixed
    return;
  }
  //sends form data to backend and mongoose saves it to mongoDB
  try {
    const res = await fetch("/api/person", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    let body;
    try {
      body = await res.json();
    } catch (err) {
      console.error("Failed to parse JSON:", err);
      message.textContent = "Server returned invalid response";
      message.className = "error";
      return;
    }
    //error response handling
    if (!res.ok) {
      //handles duplicate id numbers conflict
      if (res.status === 409) {
        message.textContent = body.message || "Duplicate ID Number found.";
        message.className = "error";
        populateForm(body.values || values);
        errId.textContent = "This ID already exists.";
        return;
      }
      //handles backend errors
      if (body.errors) {
        if (body.errors.name) errName.textContent = body.errors.name;
        if (body.errors.surname) errSurname.textContent = body.errors.surname;
        if (body.errors.idNumber) errId.textContent = body.errors.idNumber;
        if (body.errors.dateOfBirth)
          errDob.textContent = body.errors.dateOfBirth;
        if (body.errors.idNumberDobMatch)
          errId.textContent = body.errors.idNumberDobMatch;
        populateForm(body.values);
        message.textContent = "Please fix the errors.";
        message.className = "error";
        return;
      }
      //handles unknown errors
      message.textContent = body.message || "Unknown error";
      message.className = "error";
      populateForm(body.values || values);
      return;
    }
    //displays a succsess message and clears the form data
    message.textContent = "Record saved successfully.";
    message.className = "success";
    form.reset();
  } catch (err) {
    //catches network errors
    console.error(err);
    message.textContent = "Network/server error";
    message.className = "error";
  }
});
