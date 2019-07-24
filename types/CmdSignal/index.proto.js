//Status code is reserved for future use.
module.exports = `
message Message {
    message Fragment {
        optional bytes tid = 1;
        optional int32 type = 2;
        optional bytes cmd = 3;
        optional bytes args = 4;
        optional int32 status = 5;
    }
    repeated Fragment fragments = 1;
}
`;