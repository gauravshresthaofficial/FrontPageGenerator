const express = require("express");
const app = express();
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const csv = require("csv-parser")
const open = require('opn')
const dialog = require('node-file-dialog')


const fs = require("fs");
const path = require("path");

let isNew = true;

app.set("view engine", "ejs");

// Set the views directory
app.set('views', 'views');

// Parse incoming form data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// app.use(bodyParser.urlencoded({ extended: false }));

// Define a global variable to store CSV data
let csvData = [];

// Read CSV data when the server starts
fs.createReadStream(path.resolve(__dirname, "nameList.csv"))
  .pipe(csv({ headers: ["RollNumber", "Name"] })) // Specify column headers
  .on("data", (row) => {
    const rollNumber = row["RollNumber"];
    const name = row["Name"];
    csvData.push({ rollNumber, name });
  })
  .on("end", () => {
    console.log("CSV data loaded successfully");
    // console.log(csvData)
  });




app.get("/", (req, res) => {
  res.render("index", { data: csvData });
});
app.get("/success", (req, res) => {
  res.render("success");
});

app.get("/createDocx", (req, res) => {
});

app.post("/createDocx", async (req, res) => {



  // Get the blog post data from the form
  const { name, labnumber } = req.body;
  console.log(req.body)


  // Load the docx file as binary content
  const content = fs.readFileSync(
    path.resolve(__dirname, "template.docx"),
    "binary"
  );

  const zip = new PizZip(content);

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
  });

  // Function to get the roll number based on the selected name
  function getRollNumber(selectedName) {
    const selectedData = csvData.find((item) => item.name === selectedName);
    return selectedData ? selectedData.rollNumber : '';
  }

  // Function to determine the section based on the roll number
  function getSection(rollNumber) {
    // Extract the last two digits from the roll number
    const lastTwoDigits = parseInt(rollNumber.slice(-2), 10);

    if (lastTwoDigits >= 1 && lastTwoDigits <= 33) {
      return 'Section A';
    } else if (lastTwoDigits >= 34 && lastTwoDigits <= 66) {
      return 'Section B';
    } else if (lastTwoDigits === 67) {
      return 'Section A';
    } else {
      return ''; // Handle other cases if needed
    }
  }

  // Function to extract the first name from the full name
  function getFirstName(fullName) {
    const parts = fullName.split(' ');
    if (parts.length > 0) {
      return parts[0];
    } else {
      return fullName; // If no space is found, return the full name
    }
  }


  const rollno = getRollNumber(name)
  const section = getSection(rollno)


  // Render the document (Replace {first_name} by John, {last_name} by Doe, ...)
  doc.render({
    name: name,
    labnumber: labnumber,
    rollno: rollno,
    section: section,

  });

  const buf = doc.getZip().generate({
    type: "nodebuffer",
    // compression: DEFLATE adds a compression step.
    // For a 50MB output document, expect 500ms additional CPU time
    compression: "DEFLATE",
  });

  const timestamp = Date.now(); // Get the current timestamp
  const config = { type: 'directory' }

  let dir; // Declare dir as a global variable

  dialog(config)
    .then(result => {
      dir = result[0]; // Assign the result to the global dir variable
      console.log(dir);

      const docxFileName = `${getFirstName(req.body.name).toLowerCase()}_lab_${labnumber}_${timestamp}.docx`;
      const docxFilePath = path.resolve(dir, docxFileName);

      // Write the buffer to a DOCX file and save it in the directory
      fs.writeFileSync(docxFilePath, buf);

      // Open the saved DOCX file using the default application
      open(docxFilePath);


      
        // Redirect to the "success" page
        // res.redirect("/success");
        // isNew = false
        res.redirect("/")
      // res.redirect("/")
    })
    .catch(err => console.log(err));



});



app.listen(3000, () => {
  console.log("Node.js project started at port 3000");
});
