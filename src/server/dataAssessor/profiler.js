import { logger } from "../utils.js";
import csv from "csvtojson";
import { Temporal } from "@js-temporal/polyfill";
import { languageCodes } from "./ISO_639-1.js";
import libphonenumber from "google-libphonenumber";

const phoneUtil = libphonenumber.PhoneNumberUtil.getInstance();

const guessDataType = (values, phoneLocale) => {
	const possibleTypes = {
		Date: 0,
		Text: 0,
		EmailAddress: 0,
		Number: 0,
		Decimal: 0,
		Boolean: 0,
		Phone: 0,
		Locale: 0
	};
	// dateFormats
	const dateFormats = ["YYYY-MM-DDTHH:mm:ss.SSSZ"];
	for (const line of values) {
		// date time
		let possibleDate;
		try {
			Temporal.Instant.from(line);
			possibleDate = true;
		} catch {
			possibleDate = false;
		}
		// locale
		const possibleLocale = languageCodes.filter((code) => {
			try {
				if (line.toLowerCase() === code.toLowerCase()) {
					return true;
				} else if (line.startsWith(code + "-") && line.length === 5) {
					return true;
				}
				return false;
			} catch (error) {
				logger.error(error, line);
				throw new Error(
					JSON.stringify({ messsage: error.message, value: line })
				);
			}
		});

		let phNumber;
		try {
			phNumber = phoneUtil.parseAndKeepRawInput(line, phoneLocale);
		} catch {
			//nothing to catch
		}

		if (
			!line ||
			line === undefined ||
			line === "" ||
			line.length === 0 ||
			line === "<null>"
		) {
			//do nothing just here to remove
		} else if (phNumber && phoneUtil.isValidNumber(phNumber)) {
			possibleTypes.Phone++;
		} else if (possibleDate) {
			possibleTypes.Date++;
		} else if (Number.isSafeInteger(Number(line))) {
			possibleTypes.Number++;
		} else if (!Number.isNaN(line)) {
			possibleTypes.Decimal++;
		} else if (["true", "false"].includes(line.toLowerCase())) {
			possibleTypes.Boolean++;
		} else if (
			line.includes("@") &&
			/^((?!\.)[\w-_.]*[^.])(@\w+)(\.\w+(\.\w+)?\w)$/.test(line)
		) {
			possibleTypes.EmailAddress++;
		} else if (possibleLocale.length > 0) {
			possibleTypes.Locale++;
		} else {
			possibleTypes.Text++;
		}
	}
	//set any defaults here
	const bestGuess = {
		FieldType: "Text",
		match: undefined,
		total: values.length,
		MaxLength: 50,
		IsRequired: false,
		IsPrimaryKey: false
	};
	for (const type in possibleTypes) {
		if (
			possibleTypes[type] > 0 &&
			(bestGuess.match === undefined || possibleTypes[type] > bestGuess.match)
		) {
			bestGuess.FieldType = type;
			bestGuess.match = possibleTypes[type];
		}
	}
	//manage field length
	if (["Text"].includes(bestGuess.FieldType)) {
		//safe Values
		const safeValues = values.filter(
			(value) =>
				value && value !== undefined && value !== "" && value.length > 0
		);
		//get length
		const lenMax =
			safeValues.length === 0
				? 50
				: Math.max.apply(
						Math,
						safeValues.map(function (value) {
							return value.length;
						})
				  );
		const lenMin =
			safeValues.length === 0
				? 50
				: Math.min.apply(
						Math,
						safeValues.map(function (value) {
							return value.length;
						})
				  );
		// this is likely a field always filled with the same number of characters like a SFDC ID
		if (lenMax > 0 && lenMax === lenMin) {
			bestGuess.MaxLength = lenMax;
		} else if (lenMax >= 255) {
			// limit to 4000
			bestGuess.MaxLength = 4000;
		} else if (lenMax >= 50) {
			bestGuess.MaxLength = 255;
		} else if (lenMax >= 10) {
			bestGuess.MaxLength = 50;
		} else {
			// in case it is less than 10 it is likely a code of some sort so just use the max
			bestGuess.MaxLength = lenMax;
		}
	}
	if (bestGuess.FieldType === "EmailAddress") {
		bestGuess.MaxLength = 254;
	}
	if (["Date", "Number"].includes(bestGuess.FieldType)) {
		delete bestGuess.MaxLength;
	}
	// is IsRequired
	const missing = values.filter(
		(value) =>
			!value ||
			value === undefined ||
			value === "" ||
			value.length === 0 ||
			value === "<null>"
	);
	if (missing.length === 0) {
		bestGuess.IsRequired = true;
	}
	//is IsPrimaryKey key
	if (["Text", "Number", "EmailAddress"].includes(bestGuess.FieldType)) {
		const uniqueValues = [...new Set(values)];
		if (uniqueValues.length === values.length) {
			bestGuess.IsPrimaryKey = true;
		}
	}
	//to do get Scale
	if (bestGuess.FieldType === "Decimal") {
		//get length after decimal point (currently comma is not supported)
		bestGuess.Scale = Math.max.apply(
			Math,
			values.map((value) => {
				const decimals = value.split(".")[1];
				return decimals ? decimals.length : 0;
			})
		);
		const tempPrecision = Math.max.apply(
			Math,
			values.map((value) => value.length)
		);
		bestGuess.Precision =
			bestGuess.Scale > 0 ? tempPrecision - 1 : tempPrecision;
	}
	return bestGuess;
};

export async function parse(dataurl, phoneLocale, delimiter) {
	const lines = await csv({ flatKeys: true, delimiter: delimiter }).fromString(
		dataurl
	);

	//initialise object from first row
	const byField = {};
	for (const column in lines[0]) {
		if (Object.prototype.hasOwnProperty.call(lines[0], column)) {
			byField[column] = [];
		}
	}
	//add values to field
	let i = 0;
	for (const line of lines) {
		i++;
		//check columns against columns in line
		if (Object.keys(line).length != Object.keys(byField).length) {
			throw new Error(`Columns in Line ${i} not matching header line`);
		}
		for (const column in line) {
			if (Object.prototype.hasOwnProperty.call(line, column)) {
				byField[column].push(line[column]);
			}
		}
	}
	const fields = [];
	// guess data type
	for (const field in byField) {
		if (Object.prototype.hasOwnProperty.call(byField, field)) {
			const metrics = guessDataType(byField[field], phoneLocale);
			//create dataExtensionField Metadata
			fields.push({
				...metrics,
				Ordinal: fields.length,
				Name: field,
				exampleData: byField[field].slice(0, 200)
			});
		}
	}
	return fields;
}
