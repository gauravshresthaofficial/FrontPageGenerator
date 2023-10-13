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

const subjects = {
  aiw: {
    fullName: "Advance Internetworking",
    teacher: "Mr. SANJAY KUMAR YADAV",
  },
  java: {
    fullName: "Java Programming-II",
    teacher: "Mr. RAMESH SHAHI",
  },
  cg: {
    fullName: "Computer Graphics",
    teacher: "Mr. GANESH YOGI",
  },
  // Add more subjects here
  cyber: {
    fullName: "Cyber Security",
    teacher: "Mr. GANESH YOGI",
  },
  se: {
    fullName: "Software Engineering",
    teacher: "Mr. GANESH YOGI",
  },
};

// Function to load CSV data
function loadCsvData() {
  fs.createReadStream(path.resolve(__dirname, "nameList.csv"))
    .pipe(csv({ headers: ["RollNumber", "Name", "Gender"] })) // Specify column headers
    .on("data", (row) => {
      const rollNumber = row["RollNumber"];
      const name = row["Name"];
      const gender = row["Gender"];
      csvData.push({ rollNumber, name, gender });
    })
    .on("end", () => {
      console.log("CSV data loaded successfully");
    });
}

// Load CSV data when the server starts
loadCsvData();

// Configure Express
app.set("view engine", "ejs");
app.set("views", "views");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); // Use cookie parser middleware

// Define routes

// Homepage
app.get("/", (req, res) => {
  const selectedName = req.cookies.selectedName || ""; // Get the selected name from cookies
  const labNumber = req.cookies.labNumber || ""; // Get the lab number from cookies
  res.render("index", { data: csvData, selectedName, labNumber });
});

app.get("/success/:docxFileName", (req, res) => {
  const docxFileName = req.params.docxFileName;
  res.render("success", {
    docxFileName,
    name: req.cookies.name || "", // Read "name" cookie
    labnumber: req.cookies.labnumber || "", // Read "labnumber" cookie
  });
});

app.get("/download/:docxFileName", (req, res) => {
  const docxFileName = req.params.docxFileName;
  const docxFilePath = path.resolve(__dirname, "temp", docxFileName);

  // Send the generated DOCX file as a response
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${docxFileName}"`
  );
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
  const fileStream = fs.createReadStream(docxFilePath);
  fileStream.pipe(res);

  // Set a cookie to indicate that the download is complete
  res.cookie("downloadComplete", "true");

  // After the download is complete, the user will be redirected to the index page
  res.cookie("downloadComplete", "true", { expires: new Date(0) }); // Clear the downloadComplete cookie
});

// Create DOCX File
app.post("/createDocx", async (req, res) => {
  const { name, labnumber } = req.body;
  console.log(req.body);
  const selectedSemester = req.body.semester; // Access the selected semester
  const selectedSubject = req.body.subject; // Access the selected subject

  // Set cookies to store the selected values
  res.cookie("selectedName", name);
  res.cookie("labNumber", labnumber);

  // Load the DOCX template content
  const content = fs.readFileSync(
    path.resolve(__dirname, "template2.docx"),
    "binary"
  );
  const zip = new PizZip(content);

  // Initialize the Docxtemplater
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
  });

  // Helper functions
  function findGenderByName(nameToFind) {
    const result = csvData.find((record) => record.name === nameToFind);
    if (result) {
      if (result.gender === "M") // This will return 'M' or 'F' based on the name found.
      {
        return "Mr. ";
      }
      else {
        return "Ms. ";
      }
    } else {
      return "Name not found"; // Return a message if the name is not in the CSV data.
    }
  }

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

  // Render the DOCX document

  const rollno = getRollNumber(name);
  const section = getSection(rollno);
  const gender = findGenderByName(name);
  full_name = gender + name;

  doc.render({
    name: full_name,
    labnumber: labnumber,
    rollno: rollno,
    section: section,
    subject: subjects[selectedSubject].fullName,
    teacherName: subjects[selectedSubject].teacher,
    semester: selectedSemester + " Semester",
  });

  // Generate the DOCX buffer

  const buf = doc.getZip().generate({
    type: "nodebuffer",
    compression: "DEFLATE",
  });

  // Generate a unique timestamp for the file name
  const timestamp = Date.now();
  const docxFileName = `${getFirstName(
    name
  ).toLowerCase()}_${selectedSubject}__lab_${labnumber}_${timestamp}.docx`;

  // Save the generated DOCX file to a temporary folder
  const tempFolderPath = path.resolve(__dirname, "temp");
  const docxFilePath = path.resolve(tempFolderPath, docxFileName);
  fs.mkdirSync(tempFolderPath, { recursive: true });
  fs.writeFileSync(docxFilePath, buf);

  // Redirect to the "success" page with the DOCX file name
  res.redirect(`/success/${docxFileName}`);
});

// Start the server

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Node.js project started at port ${PORT}`);
});
