we are building a fullstack application in mern tech stack 
where we will show all the job posting that are related healthcare sectors in different states of USA
like florida etc

we will only scrap the jobs that are posted on the public websites means where user can see the job posting without login or signup means no login required to see the job posting 

so we need to extract all those job details with the company details and show to the user in a nice UI 

is it feasilble to complete this task or not we want to do this task all handled by code no human intervention we want to fetch jobs every time we run the code ?


if it feasible than tell me what is the optimal way to do this task and with short roadmap like what other ai library or anything else needed ?

i already know :- react, nodejs, express, mongodb, mongoose, axios, langchain, openai, etc


the main challenge is to extract each career page of the website properly some websites has route 
like below :- abc.com/join-us
somg might have => abc.com/careers

and even after moving that many be we need to click some div to choose different sectors like healthcare, engineering, etc
and after that even jobs are showing so somebody has to open each job and than we can extract the complete job details by giving html of the entire page to LLM

and this process is different is for each website 
