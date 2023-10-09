const express = require("express");
const app = express();
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const csv = require("csv-parser");
const fs = require("fs");
const path = require("path");
const cookieParser = require("cookie-parser"); // Added for cookie handling

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
  });

app.set("view engine", "ejs");
app.set("views", "views");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); // Use cookie parser middleware

app.get("/", (req, res) => {
  res.render("index", { data: csvData });
});

app.get("/success/:docxFileName", (req, res) => {
  const docxFileName = req.params.docxFileName;
  res.render("success", { docxFileName });
});

app.get("/download/:docxFileName", (req, res) => {
  const docxFileName = req.params.docxFileName;
  const docxFilePath = path.resolve(__dirname, "temp", docxFileName);

  // Send the generated DOCX file as a response
  res.setHeader("Content-Disposition", `attachment; filename="${docxFileName}"`);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  const fileStream = fs.createReadStream(docxFilePath);
  fileStream.pipe(res);

  // Set a cookie to indicate that the download is complete
  res.cookie("downloadComplete", "true");

  // After the download is complete, the user will be redirected to the index page
});

app.post("/createDocx", async (req, res) => {
  const { name, labnumber } = req.body;

  const content = fs.readFileSync(
    path.resolve(__dirname, "template.docx"),
    "binary"
  );

  const zip = new PizZip(content);

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
  });

  function getRollNumber(selectedName) {
    const selectedData = csvData.find((item) => item.name === selectedName);
    return selectedData ? selectedData.rollNumber : "";
  }

  function getSection(rollNumber) {
    const lastTwoDigits = parseInt(rollNumber.slice(-2), 10);

    if (lastTwoDigits >= 1 && lastTwoDigits <= 33) {
      return "Section A";
    } else if (lastTwoDigits >= 34 && lastTwoDigits <= 66) {
      return "Section B";
    } else if (lastTwoDigits === 67) {
      return "Section A";
    } else {
      return "";
    }
  }

  function getFirstName(fullName) {
    const parts = fullName.split(" ");
    if (parts.length > 0) {
      return parts[0];
    } else {
      return fullName;
    }
  }

  const rollno = getRollNumber(name);
  const section = getSection(rollno);

  doc.render({
    name: name,
    labnumber: labnumber,
    rollno: rollno,
    section: section,
  });

  const buf = doc.getZip().generate({
    type: "nodebuffer",
    compression: "DEFLATE",
  });

  const timestamp = Date.now();
  const docxFileName = `${getFirstName(
    req.body.name
  ).toLowerCase()}_lab_${labnumber}_${timestamp}.docx`;

  // Save the generated DOCX file to a temporary folder
  const tempFolderPath = path.resolve(__dirname, "temp");
  const docxFilePath = path.resolve(tempFolderPath, docxFileName);
  fs.mkdirSync(tempFolderPath, { recursive: true });
  fs.writeFileSync(docxFilePath, buf);

  // Redirect to the "success" page with the DOCX file name
  res.redirect(`/success/${docxFileName}`);
});

app.listen(3000, () => {
  console.log("Node.js project started at port 3000");
});
